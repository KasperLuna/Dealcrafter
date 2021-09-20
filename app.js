const PORT = process.env.PORT || 3000;
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { router } from "./router.js";
import { sess } from "./connections.js";
import express from "express";
import compression from "compression";
import fileUpload from "express-fileupload";
import pkg from "helmet";
const helmet = pkg;
const app = express();

const __dirname = dirname(fileURLToPath(import.meta.url));

app
  .set("view engine", "ejs")
  .use(
    helmet({
      contentSecurityPolicy: false,
    })
  )
  .use(express.static(join(__dirname, "public"), { maxAge: "24h" }))
  .use(express.urlencoded({ extended: true }))
  .use(express.json())
  .use(fileUpload())
  .use(sess)
  .use(compression())
  .enable("trust proxy")
  .use("/", router)
  .use(function (req, res) {
    if (req.secure) {
      res.redirect("/");
    } else {
      res.redirect("https://" + req.headers.host + req.url);
    }
  });

//Server Running

app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});
