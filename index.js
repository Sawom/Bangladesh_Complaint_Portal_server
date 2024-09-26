const express = require('express');
const cors = require('cors');
require('dotenv').config(); 
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

//connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bsdjaxv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0` ;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run(){
    try{
        await client.connect();

        // all collection
        const hotlineCollection = client.db('complainportal').collection('hotlines');
        const usersCollection = client.db('complainportal').collection('users');

        // all functions
        // get hotlines number
        app.get('/hotlines', async(req, res)=>{
            const result = await hotlineCollection.find().toArray();
            res.send(result);
        } )

        // get all users and email wise user info
        app.get('/users', async(req, res)=>{
            const email = req.query.email;
            if(email){
                const query = {email: email}
                const resultSingle = await usersCollection.find(query).toArray();
                res.send(resultSingle);
            }
            else{
                const result = await usersCollection.find().toArray();
                res.send(result);
            }
        } )

        // post info of users
        app.post('/users', async(req, res)=>{
            const user = req.body;
            const query = {email: user.email};
            const existingUser = await usersCollection.findOne(query);
            if(existingUser){
                return res.send({ message: 'user already exists!' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // update user profile
        app.put('/users/:id',  async(req,res)=>{
            const id = req.params.id;
            const updateUser = req.body;
            const filter = {_id: new ObjectId(id)};
            const options = {upsert:true};
            const updateUserInfo = {
                $set:{
                    _id: updateUser._id,
                    name: updateUser.name,
                    address: updateUser.address,
                    img: updateUser.img,
                    nid: updateUser.nid,
                    email: updateUser.email
                }
            }
            const result = await usersCollection.updateOne(filter, updateUserInfo, options);
            res.send(result);
        } )




    }
    finally{

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('complain portal running');
})

app.listen(port, ()=> {
    console.log(`complain portal server running at ${port}` );
}) 