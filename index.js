import express,{json} from 'express';
import chalk from 'chalk';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(json());

app.post('/participants',(req,res) => {
  res.send('');
});

app.get('/participants',(req,res) => {
  res.send('');
});

app.post('/messages',(req,res) => {
  res.send('');
});

app.get('/messages',(req,res) => {
  res.send('');
});

app.delete('/messages/:id',(req,res) => {
  res.send('');
});

app.put('/messages/:id',(req,res) => {
  res.send('');
});

app.post('/status',(req,res) => {
  res.send('');
});

app.listen(5000, () => console.log(chalk.bold.green('Server running on port 5000')));