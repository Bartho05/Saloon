# Salão Beleza - Sistema de Agendamento

Sistema completo de agendamento para salão de beleza com React + Node.js/Express + PostgreSQL.

## 🚀 Tecnologias

### Frontend
- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** para estilização
- **React Router v6** para roteamento
- **date-fns** + **date-fns-tz** para manipulação de datas
- **Zod** para validação
- **Vitest** + **React Testing Library** para testes

### Backend
- **Node.js 20** + **Express** + **TypeScript**
- **Prisma ORM** com **PostgreSQL**
- **JWT** para autenticação (access + refresh tokens)
- **Zod** para validação de requests
- **node-cron** para jobs agendados
- **Vitest** + **Supertest** para testes

### Infraestrutura
- **Docker** + **Docker Compose** para desenvolvimento
- **GitHub Actions** para CI/CD
- Deploy: **Railway** (backend) + **Vercel** (frontend)

## 📋 Funcionalidades

### 🌐 Público
- **Landing Page** - Apresentação do salão
- **Agendamento Online** - Fluxo de 5 passos:
  1. Escolher serviço
  2. Escolher profissional
  3. Selecionar data/hora (calendário semanal)
  4. Identificação (telefone + cadastro se novo)
  5. Confirmação
- **Login Cliente** - Via código WhatsApp (6 dígitos)
- **Meus Agendamentos** - Ver, cancelar, histórico

### 👑 Painel do Dono
- **Dashboard** - Resumo do dia/mês, faturamento
- **Serviços** - CRUD completo
- **Funcionários** - CRUD + geração de código de acesso
- **Agenda Geral** - Visualização de todas as agendas
- **Configurações** - Dados do salão, horários, WhatsApp, template de aniversário

### 👨‍🎨 Painel do Funcionário
- **Minha Agenda** - Calendário do dia com ações rápidas
- **Agendamentos** - Lista com filtros + mudança de status
- **Perfil** - Ver código de acesso + especialidades

### 🔔 Automações
- **Lembretes** - WhatsApp 1 dia antes do agendamento
- **Aniversários** - Mensagem automática no dia do aniversário
- **Confirmações** - WhatsApp ao criar/cancelar agendamento

## 🏗️ Estrutura do Projeto

```
salao-beleza/
├── backend/                 # API Node.js/Express
│   ├── src/
│   │   ├── config/          # Configurações (env, DB, WhatsApp)
│   │   ├── controllers/     # Controladores das rotas
│   │   ├── middlewares/     # Auth, validação, erros, rate limit
│   │   ├── routes/          # Definição das rotas
│   │   ├── services/        # Lógica de negócio
│   │   ├── utils/           # Helpers (datas, agendamento, feriados)
│   │   ├── tests/           # Testes unitários e integração
│   │   ├── app.ts           # Configuração Express
│   │   └── server.ts        # Entry point
│   ├── prisma/
│   │   └── schema.prisma    # Schema do banco
│   └── package.json
├── frontend/                # React + Vite
│   ├── src/
│   │   ├── components/      # Componentes reutilizáveis
│   │   ├── hooks/           # Custom hooks
│   │   ├── pages/           # Páginas (Public, Owner, Employee)
│   │   ├── services/        # API client
│   │   ├── utils/           # Helpers
│   │   ├── types/           # Interfaces TypeScript
│   │   ├── contexts/        # React Context (Auth, Toast)
│   │   ├── layouts/         # Layouts (Public, Dashboard)
│   │   ├── styles/          # CSS global
│   │   ├── App.tsx          # Rotas principais
│   │   └── main.tsx         # Entry point
│   └── package.json
├── shared/                  # Types compartilhados (opcional)
├── docker-compose.yml       # Desenvolvimento local
├── .github/workflows/ci.yml # CI/CD Pipeline
└── README.md
```

## 🛠️ Instalação Local

### Pré-requisitos
- Node.js 20+
- PostgreSQL 15+ (ou Docker)
- npm ou yarn

### 1. Clone e instale dependências

```bash
# Backend
cd salao-beleza/backend
cp .env.example .env
# Edite .env com suas configurações
npm install
npx prisma generate
npx prisma migrate dev

# Frontend
cd ../frontend
cp .env.example .env
# Edite .env se necessário
npm install
```

### 2. Com Docker (recomendado)

```bash
cd salao-beleza
docker-compose up -d
```

Acesse:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Health check: http://localhost:3000/health

### 3. Sem Docker

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 🔧 Configuração

### Variáveis de Ambiente (Backend)

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/salao_beleza"

# JWT
JWT_SECRET="sua-chave-secreta-min-32-chars"
JWT_REFRESH_SECRET="sua-refresh-secret-min-32-chars"

# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# WhatsApp (Z-API / Evolution / Meta)
WHATSAPP_PROVIDER=zapi
WHATSAPP_INSTANCE_ID=
WHATSAPP_TOKEN=
WHATSAPP_API_URL=https://api.z-api.io
```

### WhatsApp Providers Suportados
- **Z-API** (recomendado para Brasil)
- **Evolution API** (open source)
- **Meta Cloud API** (oficial)

## 🧪 Testes

```bash
# Backend
cd backend
npm run test          # Executa uma vez
npm run test:watch    # Modo watch

# Frontend
cd frontend
npm run test
npm run test:watch
npm run test:ui       # Interface visual
```

## 📦 Deploy

### Backend (Railway)
1. Conecte repositório no Railway
2. Configure variáveis de ambiente
3. Deploy automático no push para main

### Frontend (Vercel)
1. Conecte repositório no Vercel
2. Root Directory: `salao-beleza/frontend`
3. Configure `VITE_API_URL` com URL do backend
4. Deploy automático no push para main

## 📚 API Endpoints

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/owner/login` | Login dono (email/senha) |
| POST | `/auth/employee/login` | Login funcionário (código) |
| POST | `/auth/client/request-code` | Solicita código WhatsApp |
| POST | `/auth/client/verify-code` | Verifica código + login |
| POST | `/auth/refresh` | Renova access token |

### Público
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/services` | Lista serviços ativos |
| GET | `/employees/active` | Lista funcionários ativos |
| POST | `/booking/check-client` | Verifica se cliente existe |
| GET | `/booking/slots` | Horários disponíveis |
| POST | `/booking/create` | Cria agendamento |

### Cliente (autenticado)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/client/appointments` | Meus agendamentos |
| PATCH | `/client/appointments/:id/cancel` | Cancela agendamento |

### Dono (autenticado)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/owner/appointments` | Todos agendamentos |
| CRUD | `/owner/services` | Serviços |
| CRUD | `/owner/employees` | Funcionários |
| GET/PATCH | `/owner/settings` | Configurações |

### Funcionário (autenticado)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/employee/appointments` | Meus agendamentos |
| GET | `/employee/appointments/today` | Agenda de hoje |
| PATCH | `/employee/appointments/:id/status` | Atualiza status |

## 🗄️ Schema do Banco

Principais modelos:
- **User** - Dono + Funcionários (role: OWNER/EMPLOYEE)
- **Client** - Clientes (phone único)
- **Service** - Serviços oferecidos
- **Appointment** - Agendamentos (client + employee + service)
- **SalonSettings** - Configurações do salão

## 🤝 Contribuindo

1. Fork o projeto
2. Crie branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'feat: adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra Pull Request

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

- Issues: [GitHub Issues](https://github.com/Bartho05/Saloon/issues)
- Email: seu-email@exemplo.com