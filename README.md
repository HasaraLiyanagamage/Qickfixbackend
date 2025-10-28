QuickFix Backend (Node.js + Express + MongoDB)

This is the backend API for the QuickFix home service app — built with Node.js, Express, and MongoDB Atlas.
It handles authentication, booking management, technician tracking, and real-time socket updates.

🚀 Features

JWT-based authentication (User / Technician / Admin)

MongoDB (Atlas) integration

Technician availability & location tracking

Smart technician matching by proximity

RESTful APIs for user, technician, and booking management

Socket.IO for real-time location updates

Secure .env environment variable configuration

🧱 Project Structure
backend/
├── models/
│   ├── User.js
│   ├── Technician.js
│   └── Booking.js
├── routes/
│   ├── auth.js
│   ├── technician.js
│   └── booking.js
├── utils/
│   └── geo.js
├── server.js
├── package.json
└── .env.example

⚙️ Installation
1. Clone the repository
git clone https://github.com/HasaraLiyanagamage/quickfix-backend.git
cd quickfix-backend

2. Install dependencies
npm install

3. Create a .env file
cp .env.example .env


Update the .env with your values:

PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/quickfix
JWT_SECRET=mysecret

🧩 Running Locally
npm run dev


Your backend will start at:

http://localhost:5000


🔒 Security

All routes secured with JWT-based authentication.

CORS enabled for cross-origin access.

Sensitive credentials stored in .env.

🧰 Tech Stack

Node.js + Express.js

MongoDB Atlas

Mongoose

Socket.IO

JWT Authentication

👨‍💻 Author

Hasara Liyanagamage
📧 Email: hasaraliyanagamage27@gmail.com
🔗 GitHub: @HasaraLiyanagamage
