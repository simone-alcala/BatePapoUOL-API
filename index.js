import express,{json} from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
const dbName = 'projeto12_uol';

const app = express();
app.use(cors());
app.use(json());

const schema = Joi.object({
  name: Joi.string().required().trim()
});

const options = {
  abortEarly: false, // include all errors
  allowUnknown: true, // ignore unknown props
  stripUnknown: true // remove unknown props
}

app.post('/participants',async(req,res) => {

  const { error, value } = schema.validate(req.body, options);

  if (error) return res.sendStatus(422);

  try {    
    const participant = {
      name: value.name,
      lastStatus: Date.now()
    };
    await mongoClient.connect();
    const db = mongoClient.db(dbName);

    const oldParticipant = await db.collection('participants').findOne({name: participant.name});

    if (oldParticipant){
      mongoClient.close();
      return res.sendStatus(409);
    }

    await db.collection('participants').insertOne(participant);
    res.sendStatus(201);
    mongoClient.close();
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
    mongoClient.close();
  }  
});

app.get('/participants',async(req,res) => {
  try {
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    const participants = await db.collection('participants').find({}).toArray();
    res.send(participants);
    mongoClient.close();
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
    mongoClient.close();
  }
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