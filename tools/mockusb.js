(function(){
  var last = null, sampleCounter = 0, rollLeft = 0, per = 50;
  function nsOf(id){ return [1,2,5][id%3]*Math.pow(10, Math.floor(id/3)); }
  function u8(a){ return {data:new DataView(new Uint8Array(a).buffer)}; }
  function samples(nBytes, nch){ var out = []; for (var i=0;i<nBytes/2;i++){ var ch = i % nch, k = Math.floor(i/nch) + sampleCounter; var v = 2048 + ch*3;
      if (ch===0) v += (((k % per)+per)%per < per/2 ? 0 : 500);   // Rechteck 5 V bei vs 1.0
      out.push(v & 255, v >> 8); } sampleCounter += nBytes/2/nch; return out; }
  var dev = {vendorId:0x0783, productId:0x5725, manufacturerName:'Mock', productName:'Hantek1008 mock', configuration:null,
    open: async function(){}, close: async function(){}, selectConfiguration: async function(){ this.configuration = {interfaces:[{interfaceNumber:0, alternate:{endpoints:[{direction:'out',endpointNumber:2,type:'bulk',packetSize:64},{direction:'in',endpointNumber:1,type:'bulk',packetSize:64}]}}]}; },
    claimInterface: async function(){},
    transferOut: async function(ep, d){ last = Array.from(d); window.__usbOut = (window.__usbOut||0)+1; return {status:'ok'}; },
    transferIn: async function(ep, len){ var id = last[0];
      switch(id){
        case 0xc6: return u8([0x08, 0x00]);           // 2048 Byte
        case 0xa6: return u8(samples(64, window.__nch||8));
        case 0xa5: return u8([0xa5, 2]);
        case 0xe5: return u8([0xd6, 0x06]);
        case 0xb5: case 0xb6: case 0xf7: case 0xf8: return u8(new Array(64).fill(0));
        case 0xfa: return u8(new Array(56).fill(0));
        case 0xe6: return u8(new Array(10).fill(0));
        case 0xa7: return u8([0xa7, 0]);
        case 0xa0: window.__nch = last[1]; return u8([id]);
        case 0xa3: if (last[1] < 0x18){ var tdiv = nsOf(last[1])*1e-9; per = Math.max(0.37, 0.001/(tdiv/120)); } return u8([id]);
        case 0xc7: rollLeft = 9*2*20; return u8([rollLeft>>8, rollLeft&255]);
        case 0xc8: return u8(samples(64, (window.__nch||8)+1));
        default: return u8([id]);
      } } };
  Object.defineProperty(navigator, 'usb', {value:{getDevices: async function(){ return []; }, requestDevice: async function(){ return dev; }, addEventListener: function(){} }});
})();
