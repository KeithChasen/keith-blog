const { db, admin } = require('../util/admin')
const firebase = require('firebase')
const config = require('../config')
const { validatesSignUp, validatesSignIn, reduceUserDetails } = require('../util/validators')

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

    const noImg = 'no-img.png'

    let token, userId

    db
        .doc(`/users/${newUser.handle}`)
        .get()
        .then(doc => {
            if (doc.exists)
                return res.status(400).json({handle: 'this handle is already taken'})

            return firebase
                .auth()
                .createUserWithEmailAndPassword(newUser.email, newUser.password)
        })

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
                imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
                userId: userId
            }

            return db.doc(`/users/${newUser.handle}`).set(userCredentials)
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

exports.getUserInfo = (req, res) => {
    let userData = {}

    db
        .doc(`/users/${req.user.handle}`)
        .get()
        .then(doc => {
            if(doc.exists) {
                userData.credentials = doc.data()
                return db
                    .collection('likes')
                    .where('userHandle', '==', req.user.handle)
                    .get()
            }
        })
        .then(data => {
            userData.likes = []
            data.forEach(doc => {
                userData.likes.push(doc.data())
            })
            return res.json(userData)
        })
        .catch(err => {
            console.log(err)
            return res.status(500).json({ error: err.code })
        })
}

exports.addUserDetails = (req, res) => {
    let userDetails = reduceUserDetails(req.body)

    db
        .doc(`/users/${req.user.handle}`)
        .update(userDetails)
        .then(() => {
            return res.json({ message: 'Details added successfully'})
        })
        .catch(err => {
            console.log(err)
            return res.status(500).json({error: err.code})
        })
}

exports.uploadImage = (req, res) => {
    const BusBoy = require('busboy')
    const path = require('path')
    const os = require('os')
    const fs = require('fs')

    const busboy = new BusBoy({ headers: req.headers })

    let imageFileName
    let imageToBeUploaded = {}

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {

        if (mimetype !== 'image/jpeg' && mimetype !== 'image/jpg' && mimetype !== 'image/png')
            return res.status(400).json({ error: 'Wrong file type'})

        let imageNameArray = filename.split('.');
        const imageExtension = imageNameArray[imageNameArray.length - 1]
        imageFileName = `${Math.round(Math.random() * 1000000)}.${imageExtension}`
        const filepath = path.join(os.tmpdir(), imageFileName)
        imageToBeUploaded = { filepath, mimetype }
        file.pipe(fs.createWriteStream(filepath))
    })

    busboy.on('finish', () => {
        admin
            .storage()
            .bucket()
            .upload(imageToBeUploaded.filepath, {
            resumable: false,
            metadata: {
                metadata: {
                    contentType: imageToBeUploaded.mimetype
                }
            }
        })
            .then(() => {
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${
                config.storageBucket
            }/o/${imageFileName}?alt=media`
            return db.doc(`/users/${req.user.handle}`).update({ imageUrl })
        })
            .then(() => {
                return res.json({ message: 'Image uploaded successfully' })
            })
            .catch(err => {
                console.log(err)
                return res.status(500).json({ error: err.code })
            })
    })
    busboy.end(req.rawBody)
}