INSTRUÇÕES DE DEPLOY VIA SFTP
=============================

1. Faça upload de TODA esta pasta para o servidor SaveInCloud via SFTP

2. Conecte-se ao servidor via SSH e execute:

   cd /caminho/para/seu/projeto
   
   # Instale Node.js 18+ se necessário
   node --version
   
   # Instale pnpm (ou use npm)
   npm install -g pnpm
   
   # Instale dependências
   pnpm install
   # ou: npm install
   
   # Crie arquivo .env.local
   nano .env.local
   # Cole as variáveis de ambiente (veja DEPLOY_SFTP.md)
   
   # Faça o build
   pnpm build
   # ou: npm run build
   
   # Inicie com PM2
   npm install -g pm2
   pm2 start npm --name "whatsapp-api" -- start
   pm2 startup
   pm2 save

3. Configure Nginx como proxy reverso (veja DEPLOY_SFTP.md)

4. Acesse: http://seu-dominio.com

Para mais detalhes, consulte: DEPLOY_SFTP.md
