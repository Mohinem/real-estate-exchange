import { postgraphile } from "postgraphile";
import * as http from "http";
import * as dotenv from "dotenv";

dotenv.config();

const server = http.createServer(
  postgraphile(process.env.DATABASE_URL!, "public", {
    watchPg: true,
    graphiql: true,
    enhanceGraphiql: true,
    dynamicJson: true,
    allowExplain: true,
    enableCors: true,
    subscriptions: true
  })
);

server.listen(5000, () => {
  console.log(`PostGraphile running on http://localhost:5000/graphiql`);
});
