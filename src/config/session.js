// import session from "express-session";

// import { redisClient } from "./redis.js";
// import env from "./env.js";

// const sessionMiddleware = session({
//   store: new RedisStore({
//     client: redisClient,
//     prefix: "cinema:sess",
//   }),

//   secret: env.sessionSecret,
//   resave: false, // means that the session will not be saved back to the session store unless it has been modified during the request. This can help reduce unnecessary writes to the session store and improve performance.
//   saveUninitialized: false, // means that a session will not be created and stored in the session store unless it has been modified during the request. This can help reduce unnecessary session creation and improve performance.

//   cookie: {
//     httpOnly: true,
//     secure: env.nodeEnv === "production",
//     sameSite: "lax",
//     maxAge: 1000 * 60 * 60 * 24 * 7, //7days
//   },
// });

// export default sessionMiddleware;
