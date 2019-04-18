const config = require('./config')
const functions = require('firebase-functions');
const admin = require('firebase-admin')
const app = require('express')()
const firebase = require('firebase')
const validate = require('validate.js')

admin.initializeApp()
firebase.initializeApp(config)
const db = admin.firestore()

app.get('/screams', (req, res) => {
    db
        .collection('screams')
        .orderBy('createdAt', 'desc')
        .get()
        .then(data => {
            let screams = []
            data.forEach(doc => {
                screams.push({
                    screamId: doc.id,
                    body: doc.data().body,
                    userHandle: doc.data().userHandle,
                    createdAt: doc.data().createdAt
                })
            })
            return res.json(screams)
        })
        .catch(err => console.error(err))
})

app.post('/scream',(req, res) => {
    if (req.method !== 'POST')
        return res.status(400).json({ error: 'Method not allowed'})
    const newScream = {
        body: req.body.body,
        userHandle: req.body.userHandle,
        createdAt: new Date().toISOString()
    }

    db
        .collection('screams')
        .add(newScream)
        .then(doc => {
            res.json({ message: `document ${doc.id} created`})
        })
        .catch(err => {
            res.status(500).json({error: 'Something went wrong'})
            console.error(err)
        })
})

const isEmpty = string => string.trim() === ''
const isEmail = email => validate({email: email}, {email: {email: true}})
const validatesSignUp = newUser => {
    let errors = {}

    if (isEmpty(newUser.email))
        errors.email = 'Must not be empty'

    if (isEmail(newUser.email))
        errors.email = 'Email is invalid'

    if (isEmpty(newUser.password))
        errors.password = 'Must not be empty'

    if (newUser.password !== newUser.confirmPassword)
        errors.confirmPassword = 'Passwords should match'

    if (isEmpty(newUser.handle))
        errors.handle = 'Must not be empty'

    return errors
}


//signup route
app.post('/signup', (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle,
    }

    let errors = validatesSignUp(newUser)

    if (Object.keys(errors).length > 0) return res.status(400).json(errors)

    let token, userId

    db
        .doc(`/users/${newUser.handle}`)
        .get()
        .then(doc => {
            if (doc.exists)
                return res.status(400).json({ handle: 'this handle is already taken' })

            return firebase
                .auth()
                .createUserWithEmailAndPassword(newUser.email, newUser.password)
                .then(data => {
                    userId = data.user.uid
                    return data.user.getIdToken()
                })
                .then(tkn => {
                    token = tkn
                    const userCredentials = {
                        handle: newUser.handle,
                        email: newUser.email,
                        createdAt: new Date().toISOString(),
                        userId: userId
                    }
                    db.doc(`/users/${newUser.handle}`).set(userCredentials)
                })
                .then(() => {
                    return res.status(201).json({ token })
                })
                .catch(err => {
                    console.error(err)

                    if (err.code === 'auth/email-already-in-use') {
                        return res.status(400).json({email: 'Email is already in use'})
                    }

                    if (err.code === 'auth/weak-password') {
                        return res.status(400).json({email: 'Password should contain at least 6 characters'})
                    }

                    return res.status(500).json({error: err.code})
                })

        })
})

exports.api = functions.https.onRequest(app)