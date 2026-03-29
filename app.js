require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const methodOverride = require('method-override');
const ejsLayouts = require('express-ejs-layouts');
const connectDB = require('./config/db');

// Connect to MongoDB
connectDB();

const app = express();

// --- Middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(ejsLayouts);
app.set('layout', 'layouts/boilerplate');

// --- Session & Flash ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboardcat',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

// --- Passport Setup ---
app.use(passport.initialize());
app.use(passport.session());
// Passport config (strategy, serialize/deserialize) should be in authController or a separate file

// --- View Engine ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Flash & User Injection ---
app.use((req, res, next) => {
  const user = req.session?.user || req.user;
  res.locals.user = user;
  res.locals.currentUser = user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

// --- Routes ---
app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/expenses', require('./routes/expenses'));
app.use('/ocr', require('./routes/ocr'));
app.use('/', require('./routes/dashboard'));

// --- Home Redirect ---
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// --- 404 & Error Handling ---
app.all('*', (req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).render('error', { message: err.message || 'Something went wrong' });
});

// --- Server Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
