# Escape Room a Dois

Jogo cooperativo online para duas pessoas, preparado para GitHub e Render. Inclui cinco enigmas sequenciais, salas privadas por código/link, chat e tentativa de videochamada com WebRTC.

## Publicar no Render

1. Cria um repositório GitHub e envia todos os ficheiros desta pasta, mantendo a pasta `public`.
2. No Render, cria um **Web Service** ligado ao repositório.
3. Runtime: Node. Build Command: `npm install`. Start Command: `npm start`.
4. Em **Environment**, cria `ADMIN_PASSWORD` com uma palavra-passe forte escolhida por ti. Não a publiques no GitHub nem a partilhes no chat.
5. Faz deploy. O Render fornece HTTPS, necessário para permissões de câmara/microfone.

## Como jogar

- O administrador introduz `ADMIN_PASSWORD` e cria a sala.
- Copia o link da sala e envia-o à outra pessoa pelo WhatsApp.
- O segundo jogador abre o link e entra com o nome.
- Leiam as pistas, conversem pelo chat e submetam as respostas em conjunto.
- Para a câmara/microfone, ambos devem permitir o acesso no navegador.

## Notas importantes

- As salas e o progresso ficam em memória no servidor. Se o serviço reiniciar, as salas ativas desaparecem.
- O protótipo inclui um servidor STUN público para WebRTC. Dependendo das redes/firewalls, uma chamada pode precisar de um serviço TURN para ser fiável em todas as ligações.
- Não coloques segredos ou palavras-passe reais nos ficheiros do repositório.
