NV.call={socket:null,local:null,peers:new Map(),room:null,name:'Guest',muted:false,
 async join(room,name){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone needs HTTPS. Open this site using its secure HTTPS address.');
  this.local=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  this.room=room;this.name=name||'Guest';
  this.socket=io();
  this.socket.on('connect',()=>this.socket.emit('join-room',{roomId:String(room.id),roomName:room.name,userName:this.name}));
  this.socket.on('room-users',users=>users.forEach(u=>this.makePeer(u.id,true)));
  this.socket.on('user-joined',u=>{NV.toast(u.userName+' joined');this.makePeer(u.id,false);});
  this.socket.on('signal',async({from,signal})=>{let pc=this.peers.get(from);if(!pc)pc=this.makePeer(from,false);try{if(signal.type==='offer'){await pc.setRemoteDescription(signal);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);this.socket.emit('signal',{to:from,signal:pc.localDescription});}else if(signal.type==='answer'){await pc.setRemoteDescription(signal);}else if(signal.candidate){await pc.addIceCandidate(signal);} }catch(e){console.warn('WebRTC signal error',e);}});
  this.socket.on('user-left',({id})=>{this.peers.get(id)?.close();this.peers.delete(id);this.renderMembers();});
  this.socket.on('room-count',count=>{NV.$('#callStatus').textContent=count+' participant(s) connected';});
  this.socket.on('connect_error',()=>NV.toast('Could not connect to voice server.'));
  NV.$('#callRoomName').textContent=room.name;NV.$('#callStatus').textContent='Microphone ready · connecting…';NV.$('#callPanel').classList.remove('hidden');this.renderMembers();
 },
 makePeer(id,initiator){if(this.peers.has(id))return this.peers.get(id);const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});this.peers.set(id,pc);this.local.getTracks().forEach(t=>pc.addTrack(t,this.local));pc.onicecandidate=e=>{if(e.candidate)this.socket.emit('signal',{to:id,signal:e.candidate});};pc.ontrack=e=>{let a=document.getElementById('audio-'+id);if(!a){a=document.createElement('audio');a.id='audio-'+id;a.autoplay=true;a.playsInline=true;document.body.appendChild(a);}a.srcObject=e.streams[0];a.play().catch(()=>{});};pc.onconnectionstatechange=()=>{if(['failed','closed','disconnected'].includes(pc.connectionState)){if(pc.connectionState==='failed')pc.restartIce();}};if(initiator)pc.createOffer().then(o=>pc.setLocalDescription(o)).then(()=>this.socket.emit('signal',{to:id,signal:pc.localDescription})).catch(console.warn);this.renderMembers();return pc;},
 renderMembers(){const el=NV.$('#callMembers');if(!el)return;el.innerHTML=`<span class="member-chip">🎙️ ${NV.escapeHTML(this.name)} (you)</span>`+[...this.peers.keys()].map((_,i)=>`<span class="member-chip">👤 Participant ${i+1}</span>`).join('');},
 toggleMute(){if(!this.local)return;this.muted=!this.muted;this.local.getAudioTracks().forEach(t=>t.enabled=!this.muted);NV.$('#muteBtn').innerHTML=this.muted?'🔇 <span>Unmute</span>':'🎙️ <span>Mute</span>';},
 leave(){if(this.socket){this.socket.emit('leave-room');this.socket.disconnect();}this.peers.forEach(p=>p.close());this.peers.clear();if(this.local)this.local.getTracks().forEach(t=>t.stop());document.querySelectorAll('audio[id^="audio-"]').forEach(a=>a.remove());this.local=null;this.socket=null;this.room=null;NV.$('#callPanel').classList.add('hidden');}
};