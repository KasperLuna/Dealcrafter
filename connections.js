import { RedisClient, createClient } from "redis";
import { each } from "async";
import connectRedis from "connect-redis";
import session from "express-session";
import sgMail from "@sendgrid/mail";

import pgPromise from "pg-promise";
const pgp = pgPromise({});
const RedisStore = connectRedis(session);

//SENDGRID
sgMail.setApiKey(process.env.SGAPIKEY);

//REDIS || Sessions
const client = createClient(process.env.REDIS_URL);
client.on("error", (err) => {
  console.log(err);
});
const sess = session({
  store: new RedisStore({ client: client }),
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // if true only transmit cookie over https
    httpOnly: false, // if true prevent client side JS from reading the cookie
    maxAge: 1000 * 60 * 10, // session max age in miliseconds
  },
});

// --------ENVIRONMENT PGSQL----------
const db = pgp({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

RedisClient.prototype.delWildcard = function (key, callback) {
  var redis = this;
  redis.keys(key, function (err, rows) {
    each(
      rows,
      function (row, callbackDelete) {
        redis.del(row, callbackDelete);
      },
      callback
    );
  });
};

export { client, sess, db, RedisStore, sgMail };
