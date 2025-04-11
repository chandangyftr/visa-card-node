const express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
var apiRouter = require('./routes/api.routes');
const dotenv = require('dotenv');

const app = express();
app.disable('x-powered-by');

// enable CORS
const allowedDomains = process.env.ALLOWED_DOMAINS.split(',');

console.log('allowedDomains',allowedDomains);

app.use(cors({
  origin: function (origin, callback) {
    console.log("origin start:===========> ", origin);
    console.log("callback start:===========> ", callback);
    // bypass the requests with no origin (like curl requests, mobile apps, etc )
    if (!origin) return callback(null, true);
    console.log("origin: " + origin);
    if (allowedDomains.indexOf(origin) === -1) {
      var msg = `This site ${origin} does not have an access. Only specific domains are allowed to access it.`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'fail', message: "Something went wrong. Please try again later." });
});

// security and performance middlewares
app.use(helmet());
app.use(compression({ level: 9 }));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use(function (req, res, next) {
  res.setHeader('Cache-Control', 'force-cache, must-revalidate, max-age=60,');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'sameorigin');
  res.setHeader('Pragma', 'cache');
  res.setHeader('Expires', '0');
  res.setHeader('Referrer-Policy', 'no-referrer');

  res.setHeader("Access-Control-Allow-Methods", "GET,POST");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'; default-src 'unsafe-inline' 'self'; font-src 'unsafe-inline' 'self'; img-src 'self' 'unsafe-inline'  blob: data: 'unsafe-eval'; script-src 'unsafe-inline' 'self'; style-src 'self' 'unsafe-inline'; frame-src 'unsafe-inline' 'self'");
  res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});

app.get('/visacard-api/', (req, res) => {
  res.send('<h1>Welcome to Visa Card</h1>');
});

app.use('/visacard-api/api/v1', apiRouter);

app.get('/visacard-api/api/v1', (req, res) => {
  res.send('<h1>Welcome to Visa</h1>');
});

app.get('/visacard-api', (req, res) => res.send('Visa Project Node APIs'));
// catch 404 and forward to error handler
app.use(function (req, res, next) {
  res.status(404).json({ status: 'fail', statusCode: 404, message: 'requested endpoint not found' });
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  console.log(err);
  // render the error page
  res.status(err.status || 500);
  res.send(err);
});

const port = process.env.PORT || '7561'
app.set('port', port);

const server = app.listen(app.get('port'), function () {
  console.log('app listening at port %s', port);
});