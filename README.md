# 💰 Expenso - Expense Management Application

A modern, full-stack expense management application built with Node.js, Express, and EJS templating. Features role-based access control, expense tracking, approval workflows, and beautiful responsive UI.

## ✨ Features

### 🎯 **Core Functionality**
- **User Authentication**: Secure login/signup with role-based access
- **Expense Submission**: Easy expense form with receipt upload
- **Approval Workflow**: Manager approval system with status tracking
- **Multi-Currency Support**: Automatic currency conversion
- **OCR Integration**: Receipt text extraction using Tesseract.js

### 👥 **User Roles**
- **Employee**: Submit expenses, view history
- **Manager**: Approve/reject expenses, team oversight
- **Admin**: User management, system configuration

### 🎨 **Modern UI/UX**
- **Responsive Design**: Mobile-first approach
- **Modern Styling**: CSS custom properties, gradients, animations
- **Interactive Elements**: Hover effects, loading states, form validation
- **Professional Look**: Clean, business-appropriate design

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Git

### Installation

1. **Clone the repository**
    ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd Odoo-x-Amalthea--IIT-GN-Hackathon-2025-main
    ```

2. **Install dependencies**
    ```bash
    npm install
    ```

3. **Environment Setup**
   ```bash
   # Create .env file
   cp .env.example .env
   
   # Edit .env with your configuration
   MONGODB_URI=mongodb://localhost:27017/expenso
   SESSION_SECRET=your-secret-key
   ```

4. **Start the application**
    ```bash
    npm start
    ```

5. **Access the application**
   - Open http://localhost:3000 in your browser
   - Register a new account or use existing credentials

## 🏗️ Project Structure

```
├── controllers/          # Route controllers
│   ├── authController.js
│   ├── expenseController.js
│   ├── ocrController.js
│   └── userController.js
├── middleware/           # Custom middleware
│   ├── auth.js
│   ├── roleCheck.js
│   └── upload.js
├── models/              # Database models
│   ├── company.js
│   ├── expense.js
│   └── user.js
├── public/              # Static assets
│   ├── js/
│   └── styles.css
├── routes/              # Express routes
│   ├── auth.js
│   ├── expenses.js
│   ├── ocr.js
│   └── users.js
├── utils/               # Utility functions
│   ├── approvalLogic.js
│   ├── countryCurrency.js
│   └── currencyConverter.js
├── views/               # EJS templates
│   ├── layouts/
│   ├── includes/
│   ├── admin-dashboard.ejs
│   ├── employee-dashboard.ejs
│   ├── manager-dashboard.ejs
│   ├── login.ejs
│   └── signup.ejs
└── app.js              # Main application file
```

## 🎨 Design System

### Color Palette
- **Primary**: #6366f1 (Indigo)
- **Secondary**: #64748b (Slate)
- **Success**: #10b981 (Emerald)
- **Warning**: #f59e0b (Amber)
- **Danger**: #ef4444 (Red)

### Typography
- **Primary Font**: Plus Jakarta Sans
- **Heading Font**: Oswald
- **Fallback**: System fonts

### Components
- **Cards**: Modern cards with gradients and shadows
- **Buttons**: Interactive buttons with hover effects
- **Forms**: Enhanced form styling with validation
- **Tables**: Responsive tables with hover effects

## 🔧 Technology Stack

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **MongoDB**: Database
- **Mongoose**: ODM
- **Multer**: File upload handling
- **Tesseract.js**: OCR functionality

### Frontend
- **EJS**: Templating engine
- **CSS3**: Modern styling with custom properties
- **JavaScript**: Interactive functionality
- **Bootstrap**: UI framework
- **Font Awesome**: Icons

### Development Tools
- **Nodemon**: Development server
- **Express-session**: Session management
- **bcryptjs**: Password hashing
- **dotenv**: Environment variables

## 📱 Responsive Design

The application is fully responsive and optimized for:
- **Desktop**: Full-featured experience
- **Tablet**: Adapted layouts and navigation
- **Mobile**: Touch-friendly interface

## 🔐 Security Features

- **Password Hashing**: bcryptjs for secure password storage
- **Session Management**: Secure session handling
- **Role-based Access**: Different permissions for different roles
- **Input Validation**: Form validation and sanitization
- **File Upload Security**: Secure file handling

## 🚀 Deployment

### Heroku Deployment
1. Create a Heroku app
2. Set environment variables
3. Deploy using Git

### Environment Variables
```env
MONGODB_URI=your-mongodb-connection-string
SESSION_SECRET=your-session-secret
NODE_ENV=production
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Frontend Development**: Modern CSS styling and responsive design
- **Backend Development**: Node.js and Express.js implementation
- **Database Design**: MongoDB schema and relationships
- **UI/UX Design**: User experience and interface design

## 🎯 Future Enhancements

- [ ] Real-time notifications
- [ ] Advanced reporting and analytics
- [ ] Mobile app development
- [ ] Integration with accounting software
- [ ] Advanced OCR capabilities
- [ ] Multi-language support

## 📞 Support

For support, email support@expenso.com or create an issue in the repository.

---

**Built with ❤️ for the Odoo x Amalthea IIT-GN Hackathon 2025**