import express from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import moment from "moment";
import { client, db, sgMail } from "./connections.js";
const router = express.Router();
const pepper = process.env.PEPPER;

/*----------------- Functions ------------------*/
function https(req, res) {
  if (!req.secure) {
    res.redirect("https://" + req.headers.host + req.url);
    return true;
  }
}
function checkLogin(req, res) {
  // Check Login
  if (!req.session.login || !req.session.username) {
    req.session.error = 5;
    res.redirect("/");
    return true;
  }
}
function checkCookie(req, res) {
  // Checks for Login Cookies at Login Pages
  if (req.session.login || req.session.username) {
    res.redirect("/new-arrival");
    return true;
  }
}
function isInt(value) {
  // Check if value is Int
  var x = parseFloat(value);
  return !isNaN(value) && (x | 0) === x;
}
function cookieSetter(prio, email, data, req, res) {
  // Set Cookies on Login
  var login = email;
  var priority = prio;
  var username = data.rows[0].username;
  req.session.username = username;
  req.session.login = login;
  req.session.priority = priority;
  req.session.cookie.expires = false;
  req.session.cookie.maxAge = 4 * 60 * 60 * 1000; // Session Expires in 4 Hours hrs*mins*secs*ms
  res.redirect("/new-arrival");
  return;
}
function clearCache() {
  //Clears Cache of Cookies Set in NewArrivals, Locate, Manage Inventory, And Accounts
  client.delWildcard("NEWARRIVAL*", function () {});
  client.delWildcard("LOCMAN*", function () {});
  client.delWildcard("ACC*", function () {});
  console.log("cleared cache");
}
function sendMail(token, email, username) {
  // Sends Password Reset eMail
  const mailOptions = {
    from: "Dealcrafter <ejay.rellosa.dealcrafter@gmail.com>",
    to: email,
    subject: "Password Reset",
    html:
      "<body style='font-size: 31px; font-family: 'Open Sans', 'HelveticaNeue-Light', 'Helvetica Neue Light','Helvetica Neue', Helvetica, Arial, 'Lucida Grande', sans-serif; color: #404040; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; font-weight: 300 !important; margin: 0; -ms-text-size-adjust: 100%;' marginheight='0' marginwidth='0' id='dbx-email-body'> <div style='max-width: 600px !important; padding: 4px;'><table cellpadding=0 cellspacing=0 style='padding: 0 45px; width: 100% !important; padding-top: 45px; border: 1px solid #F0F0F0; background-color: #FFFFFF;' border='0' align='center'> <tr> <td align='center'> <table cellspacing'0' border='0' width='100%'> <tr> <td style='font-size: 0px;text-align: left;' valign='top'> <img src='https://i.imgur.com/gV4hTsS.png' style='' catalogid='glyph_116_98_png' width='40px'> </td> </tr> </table> <table cellpadding='0' cellspacing='0' border='0' width='100%'> <tr style='font-size: 16px; font-weight: 300; color: #404040; font-family: 'Open Sans', 'HelveticaNeue-Light', 'Helvetica Neue Light', 'Helvetica Neue', Helvetica, Arial, 'Lucida Grande', sans-serif; line-height: 26px; text-align: left;'> <td> <br> <br>Hi " +
      username +
      ", <br> <br>Someone recently requested a password change for your Dealcrafter account. If this was you, you can set a new password here: <br> <br> <a style='border-radius: 4px; font-size: 15px; color: white; text-decoration: none; padding: 14px 7px 14px 7px; width: 210px; max-width: 210px; font-family: 'Open Sans', 'Helvetica Neue', Arial; margin: 0; display: block; background-color: #007ee6; text-align: center;' href='https://dealcrafter.herokuapp.com/ResetPass?token=" +
      token +
      "&email=" +
      email +
      "' >Reset password</a> <br>If you don't want to change your password or didn't request this, just ignore and delete this message.<br> <br> <br>  - Ejay Rellosa, Dealcrafter </td></tr> <tr> <td height='40'/> </tr> </table> </td> </tr> </table> </div> </body>",
  };

  sgMail
    .send(mailOptions)
    .then(() => {
      console.log("Email sent to: " + email);
    })
    .catch((error) => {
      console.error(error);
    });
}
function locMan(req) {
  // Constructor of Locate and Manage Inventory Query
  var searchTerm, sortTerm, sort;
  searchTerm = sortTerm = sort = "";
  var sql = "SELECT * FROM products ";

  if (req.query.search) {
    if (isInt(req.query.search)) {
      sql = sql + "WHERE item_id = $1 ";
      searchTerm = req.query.search;
    } else {
      sql =
        sql +
        `WHERE item_name ILIKE $1 OR item_location ILIKE $1 OR category ILIKE $1 OR supplier ILIKE $1 `;
      searchTerm = "%" + req.query.search + "%";
    }
  }

  if (req.query.sort) {
    sortTerm = req.query.sort;
    if (sortTerm == "NameSort") {
      sort = "ORDER BY item_name ASC";
    } else if (sortTerm == "IDSort") {
      sort = "ORDER BY item_id ASC";
    } else if (sortTerm == "CategorySort") {
      sort = "ORDER BY category ASC";
    } else if (sortTerm == "SupplierSort") {
      sort = "ORDER BY supplier ASC";
    } else if (sortTerm == "QuantitySort") {
      sort = "ORDER BY quantity ASC";
    } else if (sortTerm == "PriceSortAsc") {
      sort = "ORDER BY min_price ASC";
    } else if (sortTerm == "PriceSortDesc") {
      sort = "ORDER BY min_price DESC";
    }
  }
  var cachedQuery = "LOCMAN-" + searchTerm + sortTerm;
  sql = sql + sort;
  var queryArray = [cachedQuery, sql, searchTerm];
  return queryArray;
}
function sendTestMail(email, file) {
  // Send test attachment file

  const imageStr = file.data.toString("base64");

  const mailOptions = {
    from: "Dealcrafter <ejay.rellosa.dealcrafter@gmail.com>",
    to: email,
    subject: "Test Email",
    html:
      "<body style='font-size: 31px; font-family: 'Open Sans', 'HelveticaNeue-Light', 'Helvetica Neue Light','Helvetica Neue', Helvetica, Arial, 'Lucida Grande', sans-serif; color: #404040; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; font-weight: 300 !important; margin: 0; -ms-text-size-adjust: 100%;' marginheight='0' marginwidth='0' id='dbx-email-body'> <div style='max-width: 600px !important; padding: 4px;'><table cellpadding=0 cellspacing=0 style='padding: 0 45px; width: 100% !important; padding-top: 45px; border: 1px solid #F0F0F0; background-color: #FFFFFF;' border='0' align='center'> <tr> <td align='center'> <table cellspacing'0' border='0' width='100%'> <tr> <td style='font-size: 0px;text-align: left;' valign='top'> <img src='https://i.imgur.com/gV4hTsS.png' style='' catalogid='glyph_116_98_png' width='40px'> </td> </tr> </table> <table cellpadding='0' cellspacing='0' border='0' width='100%'> <tr style='font-size: 16px; font-weight: 300; color: #404040; font-family: 'Open Sans', 'HelveticaNeue-Light', 'Helvetica Neue Light', 'Helvetica Neue', Helvetica, Arial, 'Lucida Grande', sans-serif; line-height: 26px; text-align: left;'> <td> <br> <br>Hi " +
      email +
      ", <br> <br> This is a test eMail.",
    attachments: [
      {
        content: imageStr,
        filename: "file.jpeg",
        type: "image/jpeg",
        disposition: "attachment",
      },
    ],
  };

  sgMail
    .send(mailOptions)
    .then(() => {
      console.log("Email sent to: " + email);
    })
    .catch((error) => {
      console.error(error);
    });
}
/*-------------------ROUTES--------------------*/

//Login --- Forgot Password
router
  .get("/", function (req, res) {
    if (checkCookie(req, res)) {
      return;
    }
    if (https(req, res)) {
      return;
    }
    var error = req.session.error;
    req.session.error = null;
    res.render("login", { error: error });
  })
  .post("/login", function (req, res) {
    if (checkCookie(req, res)) {
      return;
    }
    var email = req.body.email;
    var Pass = crypto
      .createHash("SHA256")
      .update(pepper + req.body.Pass + pepper)
      .digest("hex");
    var login = req.session.login;
    if (!login) {
      login = req.session.login = null;
    }
    var sql =
      "SELECT * FROM accounts WHERE email = $1; SELECT * FROM accounts WHERE email = $1 AND password = $2; SELECT * FROM accounts WHERE email = $1 AND password = $2 AND priority = true";
    db.multiResult(sql, [email, Pass])
      .then(function ([data, data1, data2]) {
        if (data.rowCount == 0) {
          console.log("Incorrect Login: Does not Exist");
          req.session.error = 1;
          res.redirect("/");
          return;
        } else if (data.rowCount >= 1 && data1.rowCount == 0) {
          console.log("Incorrect Login: Wrong Password (" + email + ")");
          req.session.error = 1;
          res.redirect("/");
          return;
        }
        if (data1.rowCount > 0) {
          if (data2.rowCount > 0) {
            cookieSetter(1, email, data, req, res);
            return;
          } else {
            cookieSetter(0, email, data, req, res);
            return;
          }
        }
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })
  .get("/forgot-password", function (req, res) {
    if (checkCookie(req, res)) {
      return;
    }
    if (https(req, res)) {
      return;
    }
    res.render("forgot");
  })
  .post("/forgot-password", function (req, res) {
    if (checkCookie(req, res)) {
      return;
    }
    var email = req.body.email;
    var sql = `SELECT * FROM accounts WHERE email = $1`;

    db.query(sql, [email])
      .then(function (data) {
        if (data[0]) {
          var token = crypto.randomBytes(64).toString("hex");
          var email = data[0].email;
          var username = data[0].username;
          var insertQuery = "UPDATE accounts SET token = $1 WHERE email = $2";
          db.query(insertQuery, [token, email])
            .then(function () {
              sendMail(token, email, username);
              req.session.error = 2;
              res.redirect("/");
            })
            .catch(function (error) {
              if (error) throw error;
            });
        } else {
          req.session.error = 4;
          res.redirect("/");
        }
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })
  .get("/ResetPass", function (req, res) {
    if (checkCookie(req, res)) {
      return;
    }
    if (https(req, res)) {
      return;
    }
    var token = req.query.token;
    var email = req.query.email;
    var sql = "SELECT * FROM accounts WHERE email = $1 AND token = $2";
    db.query(sql, [email, token])
      .then(function (data) {
        if (data[0] != undefined) {
          req.session.resetEmail = email;
          res.redirect("/newPass");
        } else {
          console.log("Invalid Token sent by: " + email);
          res.redirect("/");
        }
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })
  .get("/newPass", function (req, res) {
    if (checkCookie(req, res)) {
      return;
    }
    if (https(req, res)) {
      return;
    }
    res.render("newpassword", { email: req.session.resetEmail });
  })
  .post("/newPass", function (req, res) {
    if (checkCookie(req, res)) {
      return;
    }
    var email = req.body.email;
    var pass = crypto
      .createHash("SHA256")
      .update(pepper + req.body.password + pepper)
      .digest("hex");
    var sql = `UPDATE accounts SET password = $1, token = NULL WHERE email = $2`;
    db.query(sql, [pass, email])
      .then(function () {
        req.session.error = 3;
        req.session.resetEmail = null;
        res.redirect("/");
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })

  // -- New Arrival [SORT] --- Manage Users [EDIT USER | ADD USER] --- Locate [SORT | SEARCH] --- Manage Inventory --

  .get("/new-arrival", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    if (https(req, res)) {
      return;
    }
    var sortTerm = "";
    var sort = "";
    if (req.query.sort) {
      sortTerm = req.query.sort;
      if (sortTerm == "NameSort") {
        sort = "ORDER BY item_name ASC";
      } else if (sortTerm == "IDSort") {
        sort = "ORDER BY item_id ASC";
      } else if (sortTerm == "CategorySort") {
        sort = "ORDER BY category ASC";
      }
    }
    var sql = "SELECT * FROM products " + sort;
    sortTerm = "NEWARRIVAL-" + sortTerm;
    try {
      client.get(sortTerm, async (err, query) => {
        if (err) throw err;
        if (query) {
          res.render("newarrival", {
            moment: moment,
            queryData: JSON.parse(query),
            priority: req.session.priority,
            username: req.session.username,
            sort: 1,
          });
          console.log("data retrieved from cache: " + sortTerm);
        } else {
          db.query(sql)
            .then(function (data) {
              client.set(sortTerm, JSON.stringify(data));
              res.render("newarrival", {
                moment: moment,
                queryData: data,
                priority: req.session.priority,
                username: req.session.username,
              });
              console.log("not in cache: " + sortTerm);
            })
            .catch(function (error) {
              if (error) throw error;
            });
        }
      });
    } catch (err) {
      console.log(err);
    }
  })
  .get("/staged-items", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    if (https(req, res)) {
      return;
    }
    var sql = `SELECT * FROM stage ORDER BY date_added DESC;`;
    db.query(sql)
      .then(function (data) {
        res.render("stageditems", {
          moment: moment,
          queryData: data,
          priority: req.session.priority,
          username: req.session.username,
        });
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })
  .post("/addSingleStage", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    clearCache();

    var item_id = req.body.item_id;

    var sql = `INSERT INTO products (category, date_added, img, item_id, item_location, item_name, min_price, qr, quantity, supplier) SELECT category, date_added, img, item_id, item_location, item_name, min_price, qr, quantity, supplier FROM stage WHERE item_id = '${item_id}';
               DELETE FROM stage WHERE item_id = '${item_id}'`;
    db.multi(sql)
      .then(function () {
        console.log("Added all staged items to products");
        res.redirect("/manage-inventory");
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })
  .post("/addStage", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    clearCache();
    var sql = `INSERT INTO products (category, date_added, img, item_id, item_location, item_name, min_price, qr, quantity, supplier) SELECT category, date_added, img, item_id, item_location, item_name, min_price, qr, quantity, supplier FROM stage;
               DELETE FROM stage`;
    db.multi(sql)
      .then(function () {
        console.log("Added all staged items to products");
        res.redirect("/manage-inventory");
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })
  .post("/deleteStage", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    clearCache();
    var sql = `DELETE FROM stage;`;
    db.query(sql)
      .then(function () {
        console.log("Added all staged items to products");
        res.redirect("/manage-inventory");
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })
  .get("/manage-users", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    if (https(req, res)) {
      return;
    }
    var sql = "SELECT * FROM accounts";
    var cachedQuery = "ACCOUNTS";
    try {
      client.get(cachedQuery, async (err, query) => {
        if (err) throw err;
        if (query) {
          res.render("user", {
            queryData: JSON.parse(query),
            priority: req.session.priority,
            username: req.session.username,
          });
          console.log("data retrieved from cache: " + cachedQuery);
        } else {
          db.query(sql)
            .then(function (data) {
              client.set(cachedQuery, JSON.stringify(data));
              res.render("user", {
                queryData: data,
                priority: req.session.priority,
                username: req.session.username,
              });
              console.log("not in cache: " + cachedQuery);
            })
            .catch(function (error) {
              if (error) throw error;
            });
        }
      });
    } catch (err) {
      console.log(err);
    }
  })
  .post("/editUser", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    clearCache();
    var name = req.body.username;
    var email = req.body.email;
    var sql2 = "";

    if (req.body.password) {
      var pass = crypto
        .createHash("SHA256")
        .update(pepper + req.body.password + pepper)
        .digest("hex");
      sql2 = `UPDATE accounts SET username = $1, password = $2 WHERE email = $3`;
    } else {
      sql2 = `UPDATE accounts SET username = $1 WHERE email = $3`;
    }

    var sql = `SELECT * FROM accounts WHERE email = $1`;

    db.query(sql, [email])
      .then(function (data) {
        if (data) {
          db.query(sql2, [name, pass, email])
            .then(function () {
              console.log("Account successfully updated: " + email);
              res.redirect("/manage-users");
            })
            .catch(function (error) {
              if (error) throw error;
            });
        } else {
          console.log("Unknown Error.");
          res.redirect("/manage-users");
        }
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })
  .post("/addUser", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    clearCache();
    var name = req.body.username1;
    var email = req.body.email1;
    var pass = crypto
      .createHash("SHA256")
      .update(pepper + req.body.password1 + pepper)
      .digest("hex");

    var sql = `SELECT * FROM accounts WHERE username = $1 AND email = $2`;
    var sql2 = `INSERT INTO accounts (username, email, password, priority) VALUES ($1, $2, $3, false)`;

    db.query(sql, [name, email])
      .then(function (data) {
        if (!data.length) {
          db.query(sql2, [name, email, pass])
            .then(function () {
              console.log("Account Successfully Created: " + email);
              res.redirect("/manage-users");
            })
            .catch(function (error) {
              if (error) throw error;
            });
        } else {
          console.log("Existing Account Already Found: " + email);
          res.redirect("/manage-users");
        }
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })
  .post("/deleteUser", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    clearCache();
    var email = req.body.email;
    var sql = `DELETE FROM accounts WHERE email = $1`;
    db.query(sql, [email])
      .then(function () {
        res.redirect("/manage-users");
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })
  .get("/locate", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    if (https(req, res)) {
      return;
    }
    var queryArray = locMan(req);
    try {
      client.get(queryArray[0], async (err, query) => {
        if (err) throw err;
        if (query) {
          res.render("locate", {
            queryData: JSON.parse(query),
            priority: req.session.priority,
            username: req.session.username,
          });
          console.log("data retrieved from cache: " + queryArray[0]);
        } else {
          db.query(queryArray[1], [queryArray[2]])
            .then(function (data) {
              client.set(queryArray[0], JSON.stringify(data));
              res.render("locate", {
                queryData: data,
                priority: req.session.priority,
                username: req.session.username,
              });
              console.log("not in cache: " + queryArray[2]);
            })
            .catch(function (error) {
              if (error) throw error;
            });
        }
      });
    } catch (err) {
      console.log(err);
    }
  })
  .get("/manage-inventory", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    if (https(req, res)) {
      return;
    }
    var queryArray = locMan(req);

    try {
      client.get(queryArray[0], async (err, query) => {
        if (err) throw err;
        if (query) {
          res.render("manage", {
            queryData: JSON.parse(query),
            priority: req.session.priority,
            username: req.session.username,
          });
          console.log("data retrieved from cache: " + queryArray[0]);
        } else {
          db.query(queryArray[1], [queryArray[2]])
            .then(function (data) {
              client.set(queryArray[0], JSON.stringify(data));
              res.render("manage", {
                queryData: data,
                priority: req.session.priority,
                username: req.session.username,
              });
              console.log("not in cache: " + queryArray[2]);
            })
            .catch(function (error) {
              if (error) throw error;
            });
        }
      });
    } catch (err) {
      console.log(err);
    }
  })
  .post("/editItem", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    clearCache();
    var item_id = req.body.item_id;
    var item_name = req.body.item_name;
    var item_location = req.body.item_location;
    var supplier = req.body.supplier;
    var quantity = req.body.quantity;
    var category = req.body.category;
    var min_price = req.body.min_price;
    var img = req.body.img;
    var stageItem = req.body.stageItem;
    var sql;

    if (!req.files) {
      // ---------- If No Images -------------//
      if (stageItem == 1) {
        sql = `UPDATE stage SET item_name = $1, item_location = $2, supplier = $3, quantity = $4, category = $5, min_price = $6, img = $7 WHERE item_id = $8`;
      } else {
        sql = `UPDATE products SET item_name = $1, item_location = $2, supplier = $3, quantity = $4, category = $5, min_price = $6, img = $7 WHERE item_id = $8`;
      }
      db.query(sql, [
        item_name,
        item_location,
        supplier,
        quantity,
        category,
        min_price,
        img,
        item_id,
      ])
        .then(function () {
          if (stageItem == 1) {
            res.redirect("/staged-items");
          } else {
            res.redirect("/manage-inventory");
          }
        })
        .catch(function (error) {
          if (error) throw error;
        });
    } else {
      // ---------- If Image Uploaded -------------//
      const file = req.files.newImg;
      const name = file.name;
      if (stageItem == 1) {
        sql = `UPDATE stage SET item_name = $1, item_location = $2, supplier = $3, quantity = $4, category = $5, min_price = $6, img = $7 WHERE item_id = $8`;
      } else {
        sql = `UPDATE products SET item_name = $1, item_location = $2, supplier = $3, quantity = $4, category = $5, min_price = $6, img = $7 WHERE item_id = $8`;
      }
      file.mv("public/products/" + file.name, function (err) {
        if (err) return res.status(500).send(err);
        db.query(sql, [
          item_name,
          item_location,
          supplier,
          quantity,
          category,
          min_price,
          name,
          item_id,
        ])
          .then(function () {
            if (stageItem == 1) {
              res.redirect("/staged-items");
            } else {
              res.redirect("/manage-inventory");
            }
          })
          .catch(function (error) {
            if (error) throw error;
          });
      });
    }
  })
  .post("/deleteItem", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    clearCache();

    var item_id = req.body.item_id;
    var stageItem = req.body.stageItem[0];
    var sql;
    if (stageItem == 0) {
      sql = `DELETE FROM products WHERE item_id = '${item_id}'`;
    } else if (stageItem == 1) {
      sql = `DELETE FROM stage WHERE item_id = '${item_id}'`;
    } else if (stageItem == 2) {
      sql = `INSERT INTO stage (category, date_added, img, item_id, item_location, item_name, min_price, qr, quantity, supplier) SELECT category, date_added, img, item_id, item_location, item_name, min_price, qr, quantity, supplier FROM products WHERE item_id = '${item_id}';
      UPDATE stage SET quantity = 0-quantity WHERE item_id = '${item_id}'; 
      DELETE FROM products WHERE item_id = '${item_id}'`;
    }
    db.multi(sql)
      .then(function () {
        if (stageItem == 1) {
          res.redirect("/staged-items");
        } else {
          res.redirect("/manage-inventory");
        }
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })

  // -- Report -- Generate [ADD] -- Scan -- Logout

  .get("/report", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    if (https(req, res)) {
      return;
    }
    var dateArr = [];
    var countArr = [];

    for (let i = 0; i < 8; i++) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var f = d.toISOString().slice(0, 10).replace("T", " ");
      dateArr[i] = f;
    }

    var sql = `SELECT * FROM products ORDER BY date_added DESC;
           SELECT * FROM products ORDER BY quantity DESC;
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[0]}';
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[1]}';
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[2]}';
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[3]}';
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[4]}';
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[5]}';
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[6]}';
           SELECT COUNT(item_id) AS categoryCount, category FROM products GROUP BY category ORDER BY categoryCount DESC`;
    db.multi(sql)
      .then(function ([
        data,
        data1,
        one,
        two,
        three,
        four,
        five,
        six,
        seven,
        pie,
      ]) {
        countArr[0] = one[0].count;
        countArr[1] = two[0].count;
        countArr[2] = three[0].count;
        countArr[3] = four[0].count;
        countArr[4] = five[0].count;
        countArr[5] = six[0].count;
        countArr[6] = seven[0].count;
        res.render("report", {
          queryData: data,
          queryData1: data1,
          dateArr: dateArr,
          countArr: countArr,
          pie: pie,
          priority: req.session.priority,
          username: req.session.username,
        });
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })
  .get("/generate", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    if (https(req, res)) {
      return;
    }
    var sql = `SELECT MAX(item_id) as max_product FROM products;
               SELECT MAX(item_id) as max_stage FROM stage`;
    db.multi(sql)
      .then(function ([product, stage]) {
        res.render("generate", {
          product: product,
          stage: stage,
          priority: req.session.priority,
          username: req.session.username,
        });
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })
  .post("/addItem", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    clearCache();
    var item_id = req.body.new_id;
    var qr_filename = item_id + ".png";
    var qr_data = item_id;
    var item_name = req.body.item_name;
    var item_location = req.body.item_location;
    var supplier = req.body.supplier;
    var quantity = req.body.quantity;
    var category = req.body.category;
    var min_price = req.body.min_price;
    const file = req.files.newImg;
    const name = file.name;
    var datetime = new Date();
    var date = datetime.toISOString().slice(0, 10);

    QRCode.toFile(
      "public/QR/" + item_id + ".png",
      qr_data,
      {
        color: {
          dark: "#000000", // Blue dots
          light: "#ffffff", // Transparent background
        },
      },
      function (err) {
        if (err) throw err;
      }
    );
    // --- Sends Email of File
    //sendTestMail(req.session.login, file);

    var sql;
    if (req.session.priority == 1) {
      sql = `INSERT INTO products (item_id, item_name, item_location, supplier, quantity, category, min_price, img, qr, date_added) VALUES ('${item_id}', '${item_name}', '${item_location}', '${supplier}', '${quantity}', '${category}', '${min_price}', '${name}', '${qr_filename}', '${date}')`;
    } else {
      sql = `INSERT INTO stage (item_id, item_name, item_location, supplier, quantity, category, min_price, img, qr, date_added) VALUES ('${item_id}', '${item_name}', '${item_location}', '${supplier}', '${quantity}', '${category}', '${min_price}', '${name}', '${qr_filename}', '${date}')`;
    }

    file.mv("public/products/" + file.name, function (err) {
      if (err) console.log(err);
      db.query(sql)
        .then(function () {
          console.log("New item entry added: " + item_name);
          if (req.session.priority == 1) {
            res.redirect("/manage-inventory");
          } else {
            res.redirect("/staged-items");
          }
        })
        .catch(function (error) {
          if (error) throw error;
        });
    });
  })
  .get("/scan", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    if (https(req, res)) {
      return;
    }

    res.render("scan", {
      priority: req.session.priority,
      username: req.session.username,
    });
  })
  .get("/logout", function (req, res) {
    req.session.destroy(); // Destroys Cookie
    res.redirect("/");
  })
  .get("/RPDF", function (req, res) {
    if (checkLogin(req, res)) {
      return;
    }
    if (https(req, res)) {
      return;
    }
    var dateArr = [];
    var countArr = [];

    for (let i = 0; i < 8; i++) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var f = d.toISOString().slice(0, 10).replace("T", " ");
      dateArr[i] = f;
    }
    var d8 = new Date();
    d8.setDate(d8.getDate());
    var curDate = d8.toISOString().slice(0, 10).replace("T", " ");

    var sql = `SELECT * FROM products ORDER BY date_added DESC;
           SELECT * FROM products ORDER BY quantity DESC;
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[0]}';
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[1]}';
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[2]}';
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[3]}';
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[4]}';
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[5]}';
           SELECT COUNT(item_id) AS count FROM products WHERE date_added = '${dateArr[6]}';
           SELECT COUNT(item_id) AS categoryCount, category FROM products GROUP BY category ORDER BY categoryCount DESC`;
    db.multi(sql)
      .then(function ([
        data,
        data1,
        one,
        two,
        three,
        four,
        five,
        six,
        seven,
        pie,
      ]) {
        countArr[0] = one[0].count;
        countArr[1] = two[0].count;
        countArr[2] = three[0].count;
        countArr[3] = four[0].count;
        countArr[4] = five[0].count;
        countArr[5] = six[0].count;
        countArr[6] = seven[0].count;
        res.render("template", {
          queryData: data,
          queryData1: data1,
          dateArr: dateArr,
          countArr: countArr,
          pie: pie,
          curDate: curDate,
          priority: req.session.priority,
          username: req.session.username,
        });
      })
      .catch(function (error) {
        if (error) throw error;
      });
  })

  //HTTPS REDIRECT
  .use(function (req, res) {
    if (req.secure) {
      res.redirect("/");
    } else {
      res.redirect("https://" + req.headers.host + "/");
    }
  });

export { router };
