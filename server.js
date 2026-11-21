const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
app.use(express.static(path.join(__dirname)));
app.get('/health', (req,res)=>res.json({ok:true,service:'NeonVoice'}));
const rooms = new Map();
io.on('connection', socket => {
  socket.on('join-room', ({roomId,roomName,userName}) => {
    if (!roomId) return;
    socket.data.roomId = String(roomId);
    socket.data.userName = String(userName || 'Guest').slice(0,20);
    socket.join(String(roomId));
    if (!rooms.has(String(roomId))) rooms.set(String(roomId), new Map());
    const members = rooms.get(String(roomId));
    const existing = [...members.entries()].map(([id,u])=>({id,userName:u.userName}));
    members.set(socket.id,{userName:socket.data.userName,roomName});
    socket.emit('room-users',existing);
    socket.to(String(roomId)).emit('user-joined',{id:socket.id,userName:socket.data.userName});
    io.to(String(roomId)).emit('room-count',members.size);
  });
  socket.on('signal',({to,signal})=>{if(to && signal)io.to(to).emit('signal',{from:socket.id,signal});});
  socket.on('leave-room',()=>leave(socket));
  socket.on('disconnect',()=>leave(socket));
});
function leave(socket){
  const roomId=socket.data.roomId;if(!roomId)return;
  const members=rooms.get(roomId);if(members){members.delete(socket.id);socket.to(roomId).emit('user-left',{id:socket.id});io.to(roomId).emit('room-count',members.size);if(!members.size)rooms.delete(roomId);}
  socket.leave(roomId);socket.data.roomId=null;
}
const port=process.env.PORT||3000;
server.listen(port,'0.0.0.0',()=>console.log(`NeonVoice listening on ${port}`));
