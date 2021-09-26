const { ApolloServer } = require("apollo-server");
const typeDefs = require("./db/scheme");
const resolvers = require("./db/resolvers");

const jwt = require("jsonwebtoken");
require("dotenv").config({ path: ".env" });

const conectarDB = require("./config/db");
//conectar a la base de datos
conectarDB();

// creata a server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    const token = req.headers["authorization"] || "";
    if (token) {
      try {
        const usuario = jwt.verify(token, process.env.SECRETA);
        return { usuario };
      } catch (error) {
        console.log("hubo un error");
        console.log(error);
      }
    }
  },
});

// start server
server.listen().then(({ url }) => {
  console.log(`server ready in the URL ${url}`);
});
