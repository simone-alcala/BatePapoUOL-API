import express,{json} from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import Joi from 'joi';
import dayjs from 'dayjs';
import {stripHtml} from 'string-strip-html';

dotenv.config();

let db = '';
const mongoClient = new MongoClient(process.env.MONGO_URI);
const promise = mongoClient.connect();
promise.then ( () =>  db = mongoClient.db('projeto12_uol') ) ;
promise.catch( (err) => console.log("Deu ruim no banco", e) );

const app = express();
app.use(cors());
app.use(json());

const schemaId      = Joi.object({ id:   Joi.string().required().trim() });
const schemaName    = Joi.object({ name: Joi.string().required().trim() });
const schemaUser    = Joi.object({ user: Joi.string().required().trim() });
const schemaMessage = Joi.object({
  to:   Joi.string().required().trim(),
  text: Joi.string().required().trim(),
  type: Joi.string().required().valid('message','private_message')
});

const options = {
  abortEarly:   false, 
  allowUnknown: true, 
  stripUnknown: true 
}

function sanitize (text){
  return stripHtml(text).result;
}

verifyActiveUsers();

function verifyActiveUsers (){
  setInterval(() => {
    deleteInactiveUsers();
  }, 15000);
}

async function deleteInactiveUsers(){
  try {
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
  } catch (e) {
    console.log ('Deu ruim: ' + e);
  }
}

app.post('/participants',async(req,res) => {

  try {    

    const validation = schemaName.validate(req.body,options);

    if (validation.error) {
      res.status(422).send(validation.error.details);
      return;
    }

    const participant = {
      name: sanitize(validation.value.name),
      lastStatus: Date.now()
    };

    const alreadyRegistered = await db.collection('participants').findOne({name: participant.name});
    
    if (alreadyRegistered) {
      res.status(409).send(`User ${participant.name} already registered`);
      return;
    }

    const message = {
      from: participant.name,
      to  : 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss')
    };

    await db.collection('participants').insertOne(participant);
    await db.collection('messages').insertOne(message);

    res.status(201).send(participant.name);

  } catch (e) {
    console.log(e);   
    res.status(500).send(e); 
   }  
});

app.get('/participants',async(req,res) => {
  
  try {
    const participants = await db.collection('participants').find({}).toArray();
    res.send(participants);
  } catch (e) {
    console.log(e);
    res.status(500).send(e); 
  } 
  
});

app.post('/messages',async(req,res) => { 
  
  try {

    const validation = schemaMessage.validate(req.body,options);
    
    if (validation.error) {
      res.status(422).send(validation.error.details);
      return;
    }
    
    const validationUser = schemaUser.validate(req.headers,options);
    
    if (validationUser.error) {
      res.status(422).send(validationUser.error.details);
      return;
    }

    const user = sanitize(validationUser.value.user);
    
    const participant = await db.collection('participants').findOne({name: user});

    if (!participant) {
      res.status(404).send(`User ${user} not found`); //** VERIFICAR SE PŔECISA DESSA VALIDAÇÃO **/
      return;
    }
  
    const message = {
      to:   sanitize(validation.value.to  ),
      from: user,
      text: sanitize(validation.value.text),
      type: sanitize(validation.value.type),
      time: dayjs().format('HH:mm:ss')
    }

    await db.collection('messages').insertOne(message); 

    res.sendStatus(201);

  } catch (e) {
    console.log(e);   
    res.status(500).send(e); 
  }
});

app.get('/messages',async(req,res) => {
 
  try {

    const limit = req.query.limit;
  
    const validation = schemaUser.validate(req.headers,options);

    if (validation.error) {
      res.status(422).send(validation.error.details);
      return;
    }

    const user = sanitize(validation.value.user);
     
    const messages = 
      await db.collection('messages').find({ 
        $or: [ 
          {from: user}, 
          {to:   user},
          {to:   'Todos'}, 
          {type: 'message'} ] }).toArray();
    
    const messagesToReturn = !limit ? messages.slice(parseInt(limit) * (-1) ) : messages.slice();
       
    res.send(messagesToReturn);

  } catch (e) {
    console.log(e);   
    res.status(500).send(e); 
  }
});

app.delete('/messages/:id',async(req,res) => {
  
  try {
    
    const validationUser = schemaUser.validate(req.headers,options);
  
    if (validationUser.error) {
      res.status(422).send(validationUser.error.details);
      return;
    }
    
    const validationId = schemaId.validate(req.params,options);
  
    if (validationId.error) {
      res.status(422).send(validationId.error.details);
      return;
    }

    const user = sanitize(validationUser.value.user);
    const id = sanitize( (validationId.value.id) );
    
    const message = await db.collection('messages').findOne({ _id: new ObjectId(id) });
    
    if (!message) {
      res.status(404).send(`Message ${id} not found`); 
      return;
    }

    if (message.from !== user) {
      res.status(401).send( `User ${user} unauthorized`); 
      return;
    }

    await db.collection('messages').deleteOne({ _id: new ObjectId(id) });

    res.sendStatus(200);
        
  } catch (e){
    console.log(e);   
    res.status(500).send(e); 
  }
});

app.put('/messages/:id', async(req,res) => {

  try {

    const validation = schemaMessage.validate(req.body,options);
    
    if (validation.error) {
      res.status(422).send(validation.error.details);
      return;
    }
    
    const validationUser = schemaUser.validate(req.headers,options);
    
    if (validationUser.error) {
      res.status(422).send(validationUser.error.details);
      return;
    }

    const validationId = schemaId.validate(req.params,options);
  
    if (validationId.error) {
      res.status(422).send(validationId.error.details);
      return;
    }

    const id = sanitize( (validationId.value.id) );
    const user = sanitize(validationUser.value.user);
    
    const participant = await db.collection('participants').findOne({name: user});

    if (!participant) {
      res.status(404).send(`User ${user} not found`); //** VERIFICAR SE PŔECISA DESSA VALIDAÇÃO **/
      return;
    }

    const message = await db.collection('messages').findOne({ _id: new ObjectId(id) });
    
    if (!message) {
      res.status(404).send(`Message ${id} not found`); 
      return;
    }

    if (message.from !== user) {
      res.status(401).send( `User ${user} unauthorized`); 
      return;
    }

    const to   = sanitize(validation.value.to);
    const text = sanitize(validation.value.text);
    const type = sanitize(validation.value.type);
  
    await db.collection('messages').updateOne( 
      {_id: new ObjectId(id)} , 
      { $set: { to, text, type, time: dayjs().format('HH:mm:ss')  }} ); 

    res.sendStatus(201);

  } catch (e){
    console.log(e);   
    res.status(500).send(e); 
  }
});

app.post('/status',async(req,res) => {

  try {

    const validation = schemaUser.validate(req.headers,options);
  
    if (validation.error) {
      res.status(422).send(validation.error.details);
      return;
    }

    const user = sanitize(validation.value.user);

    const participant = await db.collection('participants').findOne({name: user});

    if (!participant) {
      res.status(404).send( `User ${user} not found`); 
      return;
    }

    const updated = await db.collection('participants').updateOne( 
      {_id: new ObjectId(participant._id)},  { $set: { lastStatus: Date.now() } } ); 
     
    res.sendStatus(200);

  } catch (e) {
    console.log(e);   
    res.status(500).send(e); 
  }

});

app.listen(5000, () => 
  console.log(chalk.bold.green('Server running on port 5000'))
);