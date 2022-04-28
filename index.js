import express,{json} from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import Joi from 'joi';
import dayjs from 'dayjs';

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
const dbName = 'projeto12_uol';

const app = express();
app.use(cors());
app.use(json());

const options = {
  abortEarly: false, // include all errors
  allowUnknown: true, // ignore unknown props
  stripUnknown: true // remove unknown props
}

app.post('/participants',async(req,res) => {

  const schema = Joi.object({
    name: Joi.string().required().trim()
  });

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

    const message = {
      from: participant.name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss')
    };

    await db.collection('participants').insertOne(participant);
    await db.collection('messages').insertOne(message);
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

app.post('/messages',async(req,res) => {
  const schema = Joi.object({
    to: Joi.string().required().trim(),
    text: Joi.string().required().trim(),
    type: Joi.string().required().valid('message','private_message')
  });

  const schemaUser = Joi.object({
    user: Joi.string().required().trim(),
  });

  const { error, value } = schema.validate(req.body, options);
  const user = req.headers.user;

  if (error) return res.sendStatus(422);

  try {
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    const participant = await db.collection('participants').find({name: user});

    if (!participant) return res.sendStatus(422);

    const message = {
      to: value.to,
      from: user,
      text: value.text,
      type: value.type,
      time: dayjs().format('HH:mm:ss')
    }

    await db.collection('messages').insertOne(message); 

    res.sendStatus(201);

    mongoClient.close();
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
    mongoClient.close();
  }
});

app.get('/messages',async(req,res) => {

  const schema = Joi.object({ user: Joi.string().required().trim()  });
  const limit = req.query.limit;
  const { error, value } = schema.validate(req.headers, options);

  if (error) return res.sendStatus(422);

  try {
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    const messages = 
      await db.collection('messages').find({ 
        $or: [ 
          {from: value.user}, 
          {to:   value.user},
          {to:   'Todos'}, 
          {type: 'message'} ] }).toArray();
    const messagesToReturn = !limit ? messages.slice(parseInt(limit) * (-1) ) : messages.slice();
    res.send(messagesToReturn);
    mongoClient.close();
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
    mongoClient.close();
  }
});

app.delete('/messages/:id',(req,res) => {
  res.send('');
});

app.put('/messages/:id',(req,res) => {
  res.send('');
});

app.post('/status',async(req,res) => {

  const schema = Joi.object({ user: Joi.string().required().trim() });

  const { error, value } = schema.validate(req.headers, options);
  
  if (error) return res.sendStatus(422);

  const user = value.user;

  try {
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    const participant = await db.collection('participants').find({name: user}).toArray();
    if (participant === 0) return res.sendStatus(404);

    await db.collection('participants').updateOne( 
      {_id: participant[0]._id},  { $set: { lastStatus: Date.now() } } ); 

    res.sendStatus(200);

    mongoClient.close();
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
    mongoClient.close();
  }

});

app.listen(5000, () => console.log(chalk.bold.green('Server running on port 5000')));