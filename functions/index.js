const functions = require('firebase-functions');
const app = require('express')()

const { getAllScreams, newScream } = require('./handlers/screams')
const {signUp, login, uploadImage } = require('./handlers/users')
const FBAuth = require('./util/FBAuth');

app.get('/screams', getAllScreams)
app.post('/scream', FBAuth, newScream)

app.post('/signup', signUp)
app.post('/login', login)
app.post('/user/image', FBAuth, uploadImage)

exports.api = functions.https.onRequest(app)
