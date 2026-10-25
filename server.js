const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const rooms = new Map();

app.use(express.static('public'));
app.get('/health', (_req, res) => res.json({ ok: true }));

const stages = [
  { title: '1. A porta do farol', story: 'A porta antiga tem uma inscrição: “Tenho cidades, mas não casas; tenho montanhas, mas não árvores; tenho água, mas não peixes. O que sou eu?”', hint: 'Podes dobrar-me e levar-me numa viagem.', answer: 'mapa', success: 'A fechadura abre! Encontraram um mapa com uma rosa dos ventos.' },
  { title: '2. A rosa dos ventos', story: 'O mapa mostra quatro letras: N, E, S, O. A nota diz: “Começa onde nasce o sol e segue para o lado oposto.” Qual é a direção oposta a ESTE?', hint: 'Pensa nos quatro pontos cardeais.', answer: 'oeste', success: 'Uma gaveta abre e revela uma chave pequena.' },
  { title: '3. A caixa da chave', story: 'Na caixa há a sequência 2, 4, 8, 16, __. Que número completa a sequência?', hint: 'Cada número é o dobro do anterior.', answer: '32', success: 'Dentro da caixa encontram um bilhete: “O tempo é precioso.”' },
  { title: '4. O relógio parado', story: 'Um relógio marca 3 horas. O ponteiro das horas avança 2 horas. Que hora passa a marcar?', hint: 'É uma pergunta direta: soma duas horas a três.', answer: '5', success: 'O relógio toca cinco vezes e uma luz ilumina o corredor.' },
  { title: '5. O código final', story: 'Juntem as respostas numéricas que descobriram: a sequência da caixa e a hora do relógio. O código final é o número da sequência seguido da hora, sem espaços.', hint: 'Usa 32 e depois 5.', answer: '325', success: 'A porta do farol abre-se. Conseguiram escapar juntos! ❤️' }
];

function publicState(room) {
  return { code: room.code, players: room.players, stage: room.stage, finished: room.stage >= stages.length, puzzle: room.stage < stages.length ? (({ answer, ...p }) => p)(stages[room.stage]) : null, messages: room.messages.slice(-40), startedAt: room.startedAt };
}
function sendState(code) {
  const room = rooms.get(code);
  if (room) io.to(code).emit('state', publicState(room));
}
function cleanText(value, max = 300) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

io.on('connection', socket => {
  socket.on('createRoom', ({ password, name } = {}, cb = () => {}) => {
    if (!ADMIN_PASSWORD) return cb({ ok: false, error: 'O administrador ainda não configurou ADMIN_PASSWORD no Render.' });
    if (String(password || '') !== ADMIN_PASSWORD) return cb({ ok: false, error: 'Palavra-passe de administrador incorreta.' });
    let code;
    do { code = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
    const room = { code, players: [], stage: 0, messages: [], startedAt: Date.now() };
    rooms.set(code, room);
    joinRoom(socket, room, name, cb);
  });
  socket.on('joinRoom', ({ code, name } = {}, cb = () => {}) => {
    const normalized = cleanText(code, 10).toUpperCase();
    const room = rooms.get(normalized);
    if (!room) return cb({ ok: false, error: 'Não encontrei essa sala. Confirma o código ou pede um novo link.' });
    if (room.players.length >= 2 && !room.players.some(p => p.id === socket.id)) return cb({ ok: false, error: 'Esta sala já tem dois jogadores.' });
    joinRoom(socket, room, name, cb);
  });
  function joinRoom(sock, room, name, cb) {
    sock.join(room.code);
    sock.data.roomCode = room.code;
    const existing = room.players.find(p => p.id === sock.id);
    if (!existing) room.players.push({ id: sock.id, name: cleanText(name || 'Jogador', 24) || 'Jogador' });
    cb({ ok: true, code: room.code });
    room.messages.push({ system: true, text: `${cleanText(name || 'Um jogador', 24)} entrou na sala.` , at: Date.now() });
    sendState(room.code);
  }
  socket.on('submitAnswer', ({ answer } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.stage >= stages.length) return;
    const normalized = cleanText(answer, 100).toLocaleLowerCase('pt-PT').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
    const expected = stages[room.stage].answer.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
    if (normalized === expected) {
      room.messages.push({ system: true, text: stages[room.stage].success, at: Date.now() });
      room.stage += 1;
      sendState(room.code);
    } else {
      socket.emit('answerResult', { ok: false, message: 'Ainda não é essa a resposta. Falem entre vocês e tentem novamente!' });
    }
  });
  socket.on('chatMessage', ({ text } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    const message = cleanText(text, 400);
    if (!player || !message) return;
    room.messages.push({ name: player.name, text: message, at: Date.now() });
    room.messages = room.messages.slice(-100);
    sendState(room.code);
  });
  socket.on('webrtc', payload => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms.has(roomCode)) return;
    socket.to(roomCode).emit('webrtc', payload);
  });
  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    room.messages.push({ system: true, text: 'Um jogador saiu da sala.', at: Date.now() });
    if (room.players.length === 0) rooms.delete(code); else sendState(code);
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Escape Room a Dois a ouvir na porta ${PORT}`));
