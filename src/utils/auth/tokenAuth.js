const jwt = require('jsonwebtoken');

const auThToken = (d) => {
  return jwt.sign(d, process.env.SECRETE_JWT, {expiresIn: '4380h'});
};

const verifyToken = (token) => {
  try {
    const t = jwt.verify(token, process.env.SECRETE_JWT);
    return t;
  } catch (err) {
    console.log(err.message);
  }

}

module.exports ={
  auThToken,
  verifyToken,
};