import express from "express";

const app = express();

app.use((req, res) => {
  res.redirect(301, "https://vividmedi.com" + req.originalUrl);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log("Redirect service running on", PORT));
