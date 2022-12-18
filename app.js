const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
var jwt = require("jsonwebtoken");
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    if (password.length >= 6) {
      const createUserQuery = `
      INSERT INTO 
        user (username,password ,name, gender) 
      VALUES 
        (
          '${username}', 
          '${hashedPassword}',
          '${name}', 
          '${gender}'
        )`;
      const dbResponse = await db.run(createUserQuery);
      response.status = 200;
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const Query = `SELECT * FROM user WHERE username LIKE '%${username}%';`;
  const loginQueryid = await db.get(Query);
  if (loginQueryid === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      loginQueryid.password
    );
    if (isPasswordMatched == true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

app.get("/test/", async (req, res) => {
  const q = `SELECT  tweet FROM tweet LEFT JOIN user on tweet.user_id = user.user_id order by date_time DESC limit 4;`;
  const result = await db.all(q);
  res.send(result);
  //console.log(result);
});
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);
  const useridQ = `SELECT * FROM user where username like '%${username}%';`;
  const resuluserid = await db.get(useridQ);
  let userid = resuluserid.user_id;
  console.log(userid);

  const Queryfinal = `SELECT username,tweet,date_time as dateTime FROM tweet LEFT JOIN user ON tweet.user_id = user.user_id WHERE tweet.user_id IN 
   (SELECT following_user_id FROM follower WHERE follower_user_id = ${userid}) order by tweet.date_time DESC limit 4;`;
  //const Queryfolloing = `SELECT following_user_id FROM follower WHERE follower_user_id = ${userid};`;
  const resultdb = await db.all(Queryfinal);
  response.send(resultdb);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const useridQ = `SELECT * FROM user where username like '%${username}%';`;
  const resuluserid = await db.get(useridQ);
  let userid = resuluserid.user_id;
  console.log(userid);

  const resultQ = `SELECT name FROM user WHERE user_id in (SELECT following_user_id FROM follower WHERE follower_user_id = ${userid}); `;
  const resuluseride = await db.all(resultQ);
  response.send(resuluseride);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);

  const useridQ = `SELECT * FROM user where username like '%${username}%';`;
  const resuluserid = await db.get(useridQ);
  let userid = resuluserid.user_id;
  console.log(userid);

  const resultQ = `SELECT name FROM user WHERE user_id in (SELECT follower_user_id FROM follower WHERE following_user_id = ${userid}); `;
  const resuluseride = await db.all(resultQ);
  response.send(resuluseride);
});

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const tweetId = request.params;
  console.log(tweetId);
  let { username } = request;
  console.log(username);

  const useridQ = `SELECT * FROM user where username like '%${username}%';`;
  const resultuserid = await db.get(useridQ);
  let userid = resultuserid.user_id;
  console.log(userid);

  const tweetuseridQ = `SELECT user_id FROM tweet WHERE tweet.tweet_id  = ${tweetId.tweetId};`;
  const tweetuserid = await db.get(tweetuseridQ);
  console.log(tweetuserid);

  const allFollowerQ = `SELECT follower_user_id FROM follower WHERE following_user_id = ${tweetuserid.user_id};`;
  const followerslist = await db.all(allFollowerQ);
  console.log(followerslist);

  let arr = followerslist;
  flag = false;
  for (let i of arr) {
    if (i.follower_user_id === userid) {
      flag = true;
    }
  }
  console.log(flag);

  //
  if (flag === true) {
    const likes = `SELECT count() as count FROM like WHERE tweet_id = ${tweetId.tweetId};`;
    const dbQ = await db.get(likes);
    console.log(dbQ);

    const replies = `SELECT count() as count FROM reply WHERE tweet_id = ${tweetId.tweetId};`;
    const dbreply = await db.get(replies);
    console.log(dbreply);

    const tweetQ = `SELECT tweet,date_time as dateTime from tweet WHERE tweet_id = ${tweetId.tweetId};`;
    const dbtweet = await db.get(tweetQ);
    console.log(dbtweet);

    const object = {
      tweet: dbtweet.tweet,
      likes: dbQ.count,
      replies: dbreply.count,
      dateTime: dbtweet.dateTime,
    };

    response.send(object);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
  ///
});

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const tweetId = request.params;
    console.log(tweetId);
    let { username } = request;
    console.log(username);

    const useridQ = `SELECT * FROM user where username like '%${username}%';`;
    const resultuserid = await db.get(useridQ);
    let userid = resultuserid.user_id;
    console.log(userid);

    const tweetuseridQ = `SELECT user_id FROM tweet WHERE tweet.tweet_id  = ${tweetId.tweetId};`;
    const tweetuserid = await db.get(tweetuseridQ);
    console.log(tweetuserid);

    const allFollowerQ = `SELECT follower_user_id FROM follower WHERE following_user_id = ${tweetuserid.user_id};`;
    const followerslist = await db.all(allFollowerQ);
    console.log(followerslist);

    let arr = followerslist;
    flag = false;
    for (let i of arr) {
      if (i.follower_user_id === userid) {
        flag = true;
      }
    }
    console.log(flag);

    //i
    if (flag === true) {
      const getnamesQ = `SELECT name from user WHERE user_id in (SELECT user_id FROM like WHERE tweet_id == ${tweetId.tweetId});`;
      const likedusernames = await db.all(getnamesQ);
      console.log(likedusernames);
      let namearr = [];
      for (let i of likedusernames) {
        namearr.push(i.name);
      }
      let object = {
        likes: namearr,
      };

      response.send(object);
    } else {
      response.status(401);
      response.send("Invalid Request ");
    }
  }
);

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);

  const useridQ = `SELECT * FROM user where username like '%${username}%';`;
  const resultuserid = await db.get(useridQ);
  let userid = resultuserid.user_id;
  console.log(userid);

  const Qtweetid = `SELECT tweet_id from tweet WHERE user_id = ${userid};`;
  const dbQtweetid = await db.get(Qtweetid);
  console.log(dbQtweetid);

  const likes = `SELECT count() as count FROM like WHERE tweet_id = ${dbQtweetid.tweet_id};`;
  const dbQ = await db.get(likes);
  console.log(dbQ);

  const replies = `SELECT count() as count FROM reply WHERE tweet_id = ${dbQtweetid.tweet_id};`;
  const dbreply = await db.get(replies);
  console.log(dbreply);

  const tweetQ = `SELECT tweet,date_time as dateTime from tweet WHERE tweet_id = ${dbQtweetid.tweet_id};`;
  const dbtweet = await db.get(tweetQ);
  console.log(dbtweet);

  const object = {
    tweet: dbtweet.tweet,
    likes: dbQ.count,
    replies: dbreply.count,
    dateTime: dbtweet.dateTime,
  };

  response.send(object);
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    let { username } = request;
    //console.log(username);
    const tweetId = request.params;

    const useridQ = `SELECT * FROM user where username like '%${username}%';`;
    const resultuserid = await db.get(useridQ);
    let userid = resultuserid.user_id;
    console.log(userid);
    const finalQ = `SELECT tweet from tweet WHERE user_id = ${userid} and tweet_id = ${tweetId.tweetId};`;
    const Qtweetid = `SELECT user_id from tweet WHERE tweet_id = ${tweetId.tweetId};`;
    const tweetuserid = await db.all(finalQ);
    console.log(tweetuserid);

    //const finalCheck = `SELECT * FROM follower WHERE follower_user_id = ${}`
    if (tweetuserid.length !== 0) {
      const DelteQ = `DELETE FROM tweet WHERE tweet_id = ${tweetId.tweetId};`;
      await db.run(DelteQ);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);
  const tweetId = request.params;

  const useridQ = `SELECT * FROM user where username like '%${username}%';`;
  const resultuserid = await db.get(useridQ);
  let userid = resultuserid.user_id;
  console.log(userid);
  const tweet = request.body;
  console.log(tweet);

  let currentDate = new Date();
  let cDay = currentDate.getDate();
  let cMonth = currentDate.getMonth() + 1;
  let cYear = currentDate.getFullYear();
  let now = new Date();

  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  let seconds = now.getSeconds();

  let timenow = `${year}-${month + 1}-${day} ${hours}:${minutes}:${seconds}`;
  console.log(timenow);

  const dbQrun = `INSERT INTO tweet(tweet,user_id,date_time) VALUES('${tweet}',${userid},'${timenow}');`;
  const resultdb = await db.run(dbQrun);
  response.send("Created a Tweet");
});

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const tweetId = request.params;
    console.log(tweetId);
    let { username } = request;
    console.log(username);

    const useridQ = `SELECT * FROM user where username like '%${username}%';`;
    const resultuserid = await db.get(useridQ);
    let userid = resultuserid.user_id;
    console.log(userid);

    const tweetuseridQ = `SELECT user_id FROM tweet WHERE tweet.tweet_id  = ${tweetId.tweetId};`;
    const tweetuserid = await db.get(tweetuseridQ);
    console.log(tweetuserid);

    const allFollowerQ = `SELECT follower_user_id FROM follower WHERE following_user_id = ${tweetuserid.user_id};`;
    const followerslist = await db.all(allFollowerQ);
    console.log(followerslist);

    let arr = followerslist;
    flag = false;
    for (let i of arr) {
      if (i.follower_user_id === userid) {
        flag = true;
      }
    }
    console.log(flag);

    //
    if (flag === true) {
      const likes = `SELECT count() as count FROM like WHERE tweet_id = ${tweetId.tweetId};`;
      const dbQ = await db.get(likes);
      console.log(dbQ);

      const replies = `SELECT count() as count FROM reply WHERE tweet_id = ${tweetId.tweetId};`;
      const dbreply = await db.get(replies);
      console.log(dbreply);

      const tweetQ = `SELECT tweet,date_time as dateTime from tweet WHERE tweet_id = ${tweetId.tweetId};`;
      const dbtweet = await db.get(tweetQ);
      console.log(dbtweet);

      const object = {
        tweet: dbtweet.tweet,
        likes: dbQ.count,
        replies: dbreply.count,
        dateTime: dbtweet.dateTime,
      };

      response.send(object);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
