const { db } = require('../util/admin')
const firebase = require('firebase')
const config = require('../config')
const { validatesSignUp, validatesSignIn } = require('../util/validators')

firebase.initializeApp(config)

exports.signUp = (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle,
    }

    let errors = validatesSignUp(newUser)

    if (Object.keys(errors).length > 0)
        return res.status(400).json(errors)

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
}

exports.login = (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password,
    }

    let errors = validatesSignIn(user)

    if (Object.keys(errors).length > 0)
        return res.status(400).json(errors)

    firebase
        .auth()
        .signInWithEmailAndPassword(user.email, user.password)
        .then(data => {
            return data.user.getIdToken()
        })
        .then(token => {
            return res.json({token})
        })
        .catch(err => {
            console.error(err)

            if (err.code === 'auth/wrong-password') {
                return res.status(403).json({ general: 'Wrong credentials, please try again'})
            }

            return res.status(500).json({error: err.code})
        })

}