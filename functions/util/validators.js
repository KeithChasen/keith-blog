const validate = require('validate.js')

const isEmpty = string => string.trim() === ''

const isEmail = email => validate({email: email}, {email: {email: true}})

exports.validatesSignUp = newUser => {
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

exports.validatesSignIn = user => {
    let errors = {}

    if (isEmpty(user.email))
        errors.email = 'Must not be empty'

    if (isEmpty(user.password))
        errors.password = 'Must not be empty'

    return errors
}