package de.jc.diagnose;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/** Klassisches Bluetooth (SPP/RFCOMM) und WLAN-TCP für ELM327-Adapter. */
@CapacitorPlugin(
    name = "JCLink",
    permissions = { @Permission(alias = "btconnect", strings = { Manifest.permission.BLUETOOTH_CONNECT }) }
)
public class JCLinkPlugin extends Plugin {
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private static class Link {
        Closeable closer;
        OutputStream out;
        volatile boolean open = true;
    }
    private interface Closeable { void close(); }

    private final ConcurrentHashMap<Integer, Link> links = new ConcurrentHashMap<>();
    private final AtomicInteger nextId = new AtomicInteger(1);

    private boolean needBtPermission() {
        return Build.VERSION.SDK_INT >= 31
            && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void listBonded(PluginCall call) {
        if (needBtPermission()) {
            requestPermissionForAlias("btconnect", call, "listPerm");
            return;
        }
        doList(call);
    }

    @PermissionCallback
    private void listPerm(PluginCall call) {
        if (needBtPermission()) { call.reject("Bluetooth-Berechtigung nicht erteilt."); return; }
        doList(call);
    }

    @SuppressLint("MissingPermission")
    private void doList(PluginCall call) {
        BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
        if (ad == null) { call.reject("Dieses Gerät hat kein Bluetooth."); return; }
        if (!ad.isEnabled()) { call.reject("Bluetooth ist ausgeschaltet. Bitte einschalten."); return; }
        JSArray arr = new JSArray();
        Set<BluetoothDevice> set = ad.getBondedDevices();
        if (set != null) {
            for (BluetoothDevice d : set) {
                JSObject o = new JSObject();
                o.put("name", d.getName() == null ? "" : d.getName());
                o.put("address", d.getAddress());
                arr.put(o);
            }
        }
        JSObject res = new JSObject();
        res.put("devices", arr);
        call.resolve(res);
    }

    @PluginMethod
    public void open(PluginCall call) {
        final String kind = call.getString("kind", "");
        if ("spp".equals(kind) && needBtPermission()) {
            requestPermissionForAlias("btconnect", call, "openPerm");
            return;
        }
        startOpen(call);
    }

    @PermissionCallback
    private void openPerm(PluginCall call) {
        if (needBtPermission()) { call.reject("Bluetooth-Berechtigung nicht erteilt."); return; }
        startOpen(call);
    }

    private void startOpen(final PluginCall call) {
        final String kind = call.getString("kind", "");
        final String address = call.getString("address", "");
        final String host = call.getString("host", "");
        final int port = call.getInt("port", 35000);
        call.setKeepAlive(true);
        new Thread(() -> {
            try {
                final int id = nextId.getAndIncrement();
                final Link link = new Link();
                InputStream in;
                if ("spp".equals(kind)) {
                    in = openSpp(address, link);
                } else if ("tcp".equals(kind)) {
                    in = openTcp(host, port, link);
                } else {
                    throw new Exception("Unbekannter Verbindungstyp.");
                }
                links.put(id, link);
                JSObject res = new JSObject();
                res.put("id", id);
                call.resolve(res);
                call.setKeepAlive(false);
                readLoop(id, in, link);
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? e.toString() : e.getMessage());
            }
        }, "jc-open").start();
    }

    @SuppressLint("MissingPermission")
    private InputStream openSpp(String address, Link link) throws Exception {
        BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
        if (ad == null || !ad.isEnabled()) throw new Exception("Bluetooth ist ausgeschaltet.");
        BluetoothDevice dev = ad.getRemoteDevice(address);
        try { ad.cancelDiscovery(); } catch (Exception ignore) { }
        BluetoothSocket sock = null;
        Exception first = null;
        try {
            sock = dev.createRfcommSocketToServiceRecord(SPP);
            sock.connect();
        } catch (Exception e) {
            first = e;
            try { if (sock != null) sock.close(); } catch (Exception ignore) { }
            try {
                // Fallback für viele Klone, die kein SDP-Verzeichnis haben
                sock = (BluetoothSocket) dev.getClass().getMethod("createRfcommSocket", int.class).invoke(dev, 1);
                sock.connect();
            } catch (Exception e2) {
                try { if (sock != null) sock.close(); } catch (Exception ignore) { }
                throw new Exception("Bluetooth-Verbindung fehlgeschlagen (" + (first.getMessage() == null ? first : first.getMessage()) + "). Adapter eingesteckt, Zündung an, nicht schon von einer anderen App belegt?");
            }
        }
        final BluetoothSocket s = sock;
        link.out = s.getOutputStream();
        link.closer = () -> { try { s.close(); } catch (Exception ignore) { } };
        return s.getInputStream();
    }

    private InputStream openTcp(String host, int port, Link link) throws Exception {
        if (host == null || host.isEmpty()) throw new Exception("Adresse fehlt.");
        Socket sock = null;
        ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        // Socket ans WLAN binden, auch wenn das WLAN („OBDII“) kein Internet hat und Android sonst Mobilfunk nutzt
        if (cm != null) {
            try {
                for (Network n : cm.getAllNetworks()) {
                    NetworkCapabilities c = cm.getNetworkCapabilities(n);
                    if (c != null && c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                        sock = n.getSocketFactory().createSocket();
                        break;
                    }
                }
            } catch (Exception ignore) { sock = null; }
        }
        if (sock == null) sock = new Socket();
        try {
            sock.connect(new InetSocketAddress(host, port), 6000);
        } catch (Exception e) {
            try { sock.close(); } catch (Exception ignore) { }
            throw new Exception("WLAN-Adapter " + host + ":" + port + " nicht erreichbar. Mit dem WLAN des Adapters verbunden (Name oft „OBDII“, „WiFi_OBDII“, „V-LINK“)? Adresse und Port stimmen?");
        }
        sock.setTcpNoDelay(true);
        final Socket s = sock;
        link.out = s.getOutputStream();
        link.closer = () -> { try { s.close(); } catch (Exception ignore) { } };
        return s.getInputStream();
    }

    private void readLoop(final int id, final InputStream in, final Link link) {
        byte[] buf = new byte[1024];
        try {
            int n;
            while (link.open && (n = in.read(buf)) >= 0) {
                if (n == 0) continue;
                JSObject o = new JSObject();
                o.put("id", id);
                o.put("text", new String(buf, 0, n, StandardCharsets.ISO_8859_1));
                notifyListeners("data", o);
            }
        } catch (Exception ignore) {
            // Verbindung beendet
        }
        links.remove(id);
        link.open = false;
        if (link.closer != null) link.closer.close();
        JSObject o = new JSObject();
        o.put("id", id);
        notifyListeners("closed", o);
    }

    @PluginMethod
    public void write(PluginCall call) {
        final Integer id = call.getInt("id");
        final String text = call.getString("text", "");
        final Link link = id == null ? null : links.get(id);
        if (link == null || link.out == null) { call.reject("Verbindung ist getrennt."); return; }
        new Thread(() -> {
            try {
                synchronized (link) {
                    link.out.write(text.getBytes(StandardCharsets.ISO_8859_1));
                    link.out.flush();
                }
                call.resolve();
            } catch (Exception e) {
                call.reject("Senden fehlgeschlagen: " + e.getMessage());
            }
        }, "jc-write").start();
    }

    @PluginMethod
    public void close(PluginCall call) {
        Integer id = call.getInt("id");
        Link link = id == null ? null : links.remove(id);
        if (link != null) {
            link.open = false;
            if (link.closer != null) link.closer.close();
        }
        call.resolve();
    }
}
