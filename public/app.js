const socket = io();
const $ = id => document.getElementById(id);
let currentCode = null, localStream = null, peer = null, startedAt = null, timerInterval = null;
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function setLobbyStatus(text) { $('lobbyStatus').textContent = text || ''; }
function setMediaStatus(text) { $('mediaStatus').textContent = text || ''; }
function joinFromForm(create) {
  const name = $('name').value.trim() || 'Jogador';
  setLobbyStatus('');
  const event = create ? 'createRoom' : 'joinRoom';
  const payload = create ? { name, password: $('adminPassword').value } : { name, code: $('roomCode').value.trim().toUpperCase() };
  socket.emit(event, payload, result => {
    if (!result?.ok) { setLobbyStatus(result?.error || 'Não foi possível entrar.'); return; }
    currentCode = result.code;
    $('lobby').classList.add('hidden'); $('game').classList.remove('hidden');
    $('roomLabel').textContent = currentCode;
    const url = new URL(location.href); url.searchParams.set('room', currentCode); history.replaceState({}, '', url);
    setLobbyStatus('');
  });
}
$('createBtn').addEventListener('click', () => joinFromForm(true));
$('joinBtn').addEventListener('click', () => joinFromForm(false));
$('shareBtn').addEventListener('click', async () => {
  const url = new URL(location.href); url.searchParams.set('room', currentCode);
  try { await navigator.clipboard.writeText(url.toString()); $('shareBtn').textContent = 'Link copiado!'; }
  catch { window.prompt('Copia este link e envia pelo WhatsApp:', url.toString()); }
});
$('answerForm').addEventListener('submit', e => { e.preventDefault(); if (!$('answer').value.trim()) return; socket.emit('submitAnswer', { answer: $('answer').value }); $('answer').value = ''; });
socket.on('answerResult', result => { $('answerStatus').textContent = result.message; });
$('chatForm').addEventListener('submit', e => { e.preventDefault(); const text = $('chatInput').value.trim(); if (text) socket.emit('chatMessage', { text }); $('chatInput').value = ''; });

socket.on('state', state => {
  currentCode = state.code; $('roomLabel').textContent = state.code;
  $('players').innerHTML = '';
  state.players.forEach(p => { const el = document.createElement('span'); el.className = 'player'; el.textContent = '👤 ' + p.name; $('players').appendChild(el); });
  $('chat').innerHTML = '';
  state.messages.forEach(m => {
    const el = document.createElement('div'); el.className = 'message' + (m.system ? ' system' : '');
    if (m.system) el.textContent = m.text;
    else { const name = document.createElement('strong'); name.textContent = m.name + ': '; el.append(name, document.createTextNode(m.text)); }
    $('chat').appendChild(el);
  });
  $('chat').scrollTop = $('chat').scrollHeight;
  $('answerStatus').textContent = '';
  if (state.finished) {
    $('stageLabel').textContent = 'MISSÃO CONCLUÍDA'; $('puzzleTitle').textContent = 'O farol está livre!'; $('puzzleStory').textContent = 'Resolveram todos os enigmas em equipa.'; $('puzzleHint').textContent = 'Conseguiram escapar juntos!'; $('answerForm').classList.add('hidden'); $('victory').classList.remove('hidden');
  } else {
    $('stageLabel').textContent = `DESAFIO ${state.stage + 1} DE 5`; $('puzzleTitle').textContent = state.puzzle.title; $('puzzleStory').textContent = state.puzzle.story; $('puzzleHint').textContent = state.puzzle.hint; $('answerForm').classList.remove('hidden'); $('victory').classList.add('hidden');
  }
  if (!startedAt) { startedAt = state.startedAt || Date.now(); timerInterval = setInterval(updateTimer, 1000); updateTimer(); }
});
function updateTimer() { if (!startedAt) return; const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000)); $('timer').textContent = `⏱ ${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`; }

async function createPeer() {
  peer = new RTCPeerConnection(rtcConfig);
  peer.onicecandidate = e => { if (e.candidate) socket.emit('webrtc', { type: 'candidate', candidate: e.candidate }); };
  peer.ontrack = e => { $('remoteVideo').srcObject = e.streams[0]; };
  peer.onconnectionstatechange = () => { if (peer && ['failed','disconnected','closed'].includes(peer.connectionState)) setMediaStatus('A ligação de vídeo foi interrompida.'); };
  if (localStream) localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
}
$('cameraBtn').addEventListener('click', async () => {
  if (!currentCode) return setMediaStatus('Entra numa sala primeiro.');
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); $('localVideo').srcObject = localStream;
    await createPeer();
    const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
    socket.emit('webrtc', { type: 'offer', offer });
    $('cameraBtn').textContent = 'Câmara ligada'; setMediaStatus('Câmara e microfone ligados. Se o outro jogador já estiver na sala, a chamada será negociada.');
  } catch (err) { setMediaStatus('Não foi possível ligar a câmara/microfone. Confirma as permissões do navegador e usa HTTPS.'); }
});
$('hangupBtn').addEventListener('click', () => {
  if (localStream) localStream.getTracks().forEach(t => t.stop()); localStream = null;
  if (peer) peer.close(); peer = null; $('localVideo').srcObject = null; $('remoteVideo').srcObject = null; $('cameraBtn').textContent = 'Ligar câmara'; setMediaStatus('Câmara e microfone desligados.');
});
socket.on('webrtc', async payload => {
  try {
    if (payload.type === 'offer') {
      if (!localStream) localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      $('localVideo').srcObject = localStream;
      if (peer) peer.close(); await createPeer(); await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));
      const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); socket.emit('webrtc', { type: 'answer', answer }); setMediaStatus('Chamada ligada.');
    } else if (payload.type === 'answer' && peer) await peer.setRemoteDescription(new RTCSessionDescription(payload.answer));
    else if (payload.type === 'candidate' && peer && payload.candidate) await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
  } catch (err) { setMediaStatus('Não foi possível estabelecer a chamada. Tenta desligar e ligar novamente.'); }
});

const roomFromUrl = new URLSearchParams(location.search).get('room');
if (roomFromUrl) $('roomCode').value = roomFromUrl.toUpperCase();
window.addEventListener('beforeunload', () => { if (timerInterval) clearInterval(timerInterval); });
