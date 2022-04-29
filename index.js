import express,{json} from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
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

function showErrorMessages(e,res){
  if (e.name === 'TypeError') return res.sendStatus(500);
    else if (e.name === 'ValidationError' || e === 'notInserted' || e === 'notUpdated') return res.sendStatus(422);
    else if(e === 'alreadyRegistered') return res.sendStatus(409);
    else if(e === 'notFound') return res.sendStatus(404);
    else return res.status(500).send(e);
}

function verifyActiveUsers (){
  setInterval(() => {
    deleteInactiveUsers();
  }, 15000);
}

verifyActiveUsers();

async function deleteInactiveUsers(){
  try {
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    const participants = await db.collection('participants').find({lastStatus: { $lt: Date.now()-10000 } }).toArray();
    
    for (let participant of participants){    
    
      const deleted = await db.collection('participants').deleteOne({_id: new ObjectId(participant._id) } ) ;

      if (deleted.deletedCount > 0) {
        const message = {
          from: participant.name,
          to  : 'Todos',
          text: 'sai na sala...',
          type: 'status',
          time: dayjs().format('HH:mm:ss')
        };
    
        await db.collection('messages').insertOne(message);
      }
    }
    mongoClient.close();
    
  } catch (e) {
    console.log ('Deu ruim: ' + e);
  }
}

app.post('/participants',async(req,res) => {
  const schema = Joi.object({ name: Joi.string().required().trim() });
  try {    
    const value = await schema.validateAsync(req.body,options);
    const participant = {
      name: value.name,
      lastStatus: Date.now()
    };
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    const alreadyRegistered = await db.collection('participants').findOne({name: participant.name});
    if (alreadyRegistered) throw new Error().message = 'alreadyRegistered';

    const message = {
      from: participant.name,
      to  : 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss')
    };

    const insertedParticipant = await db.collection('participants').insertOne(participant);
    const insertedMessage = await db.collection('messages').insertOne(message);

    if  (!(insertedParticipant.acknowledged && insertedMessage.acknowledged) )
      throw new Error().message = 'notInserted';
    res.sendStatus(201);
    mongoClient.close();
  } catch (e) {
    mongoClient.close();
    console.log(e);   
    showErrorMessages(e,res);
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
    to:   Joi.string().required().trim(),
    text: Joi.string().required().trim(),
    type: Joi.string().required().valid('message','private_message')
  });
  const schemaUser = Joi.object({
    user: Joi.string().required().trim(),
  });
  try {
    const value = await schema.validateAsync(req.body,options);
    const valueUser = await schemaUser.validateAsync(req.headers,options);

    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    
    const participant = await db.collection('participants').findOne({name: valueUser.user});

    if (!participant) throw new Error().message = 'notFound'; //** VERIFICAR SE PŔECISA DESSA VALIDAÇÃO **/;
    
    const message = {
      to: value.to,
      from: valueUser.user,
      text: value.text,
      type: value.type,
      time: dayjs().format('HH:mm:ss')
    }

    const insertedMessage = await db.collection('messages').insertOne(message); 

    if (!insertedMessage.acknowledged) throw new Error().message = 'notInserted';

    res.sendStatus(201);
    mongoClient.close();

  } catch (e) {

    console.error(e);
    mongoClient.close();
    showErrorMessages(e,res);

  }
});

app.get('/messages',async(req,res) => {

  const schema = Joi.object({ user: Joi.string().required().trim()  });
  const limit = req.query.limit;

  try {

    const value = await schema.validateAsync(req.headers,options);
    
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
    mongoClient.close();
    console.log(e);   
    showErrorMessages(e,res);   
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

  try {
    
    const value = await schema.validateAsync(req.headers,options);

    await mongoClient.connect();
    const db = mongoClient.db(dbName);

    const participant = await db.collection('participants').findOne({name: value.user});

    if (!participant) throw new Error().message = 'notFound';

    const updated = await db.collection('participants').updateOne( 
      {_id: new ObjectId(participant._id)},  { $set: { lastStatus: Date.now() } } ); 

    if (!updated.acknowledged) throw new Error().message = 'notUpdated';

    res.sendStatus(200);

    mongoClient.close();
  } catch (e) {
    mongoClient.close();
    console.log(e);   
    showErrorMessages(e,res);  
  }

});

app.listen(5000, () => console.log(chalk.bold.green('Server running on port 5000')));