if(process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require("express");
const mongoose = require("mongoose");
const cors = require('cors');
const ejs = require("ejs");
const path = require('path');
const dotenv = require("dotenv");
const {Configuration, OpenAIApi} = require('openai');
const session = require('express-session');
const passport = require("passport");
const LocalStrategy = require('passport-local');

const { isLoggedIn } = require("./middleware"); 

const Group = require('./models/group');
const Student = require('./models/student');
const Teacher = require("./models/teacher")
const User = require('./models/user');

const userRoutes = require('./routes/auth/users');

const app = express();

const sessionConfig = {
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}

app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());

/*passport.use(new LocalStrategy(Student.authenticate()));



passport.serializeUser(Student.serializeUser());
passport.deserializeUser(Student.deserializeUser());


//passport.use(new LocalStrategy(Teacher.authenticate()));

//passport.serializeUser(Teacher.serializeUser());
//passport.deserializeUser(Teacher.deserializeUser());
*/

passport.use('studentLocal', new LocalStrategy(Student.authenticate()));
passport.use('teacherLocal', new LocalStrategy(Teacher.authenticate()))

passport.serializeUser(function(user, done) { 
    done(null, user);
  });
  
  passport.deserializeUser(function(user, done) {
    if(user!=null)
      done(null,user);
  });


mongoose.connect("mongodb://127.0.0.1:27017/whiteboard", {useNewUrlParser: true, useUnifiedTopology: true})
.then(() => {
    console.log('MONGO CONNECTION OPEN!!');
})
.catch((err) => {
    console.log("CONNECTION ERROR");
    console.log(err);
})

const db = mongoose.connection;
db.on('error', console.error)


dotenv.config();


app.use(cors());
app.use(express.json())
app.use(express.urlencoded({extended: true}))

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));
app.use(express.static(path.join(__dirname, 'public')));

/*const http = require("http").createServer();
const io = require("socket.io")(http, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true
    }
});
*/

const http = require('http').Server(app);
const io = require('socket.io')(http)

let urls = [];

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY
})

const openai = new OpenAIApi(configuration);

/*
app.use((req, res, next) => {
    //console.log(req.session);
    //console.log(req.user);
    //res.locals.currentUser = req.user;
   // console.log('current user ', currentUser);
   console.log('this is middleqare');
    next();
    //console.log('called next');
});*/


app.use((req, res, next) => {
    console.log(req.session)
    console.log(req.user);
    res.locals.currentUser = req.user;
    
    
    //console.log('current user ', currentUser)
    console.log('middleware')
    next();
})



//app.use('/', userRoutes);

app.get('/register', (req, res) => {
    res.render('register')
})

app.post('/register', async (req, res) => {
    try{
        console.log('in register route req.body is ', req.body);
        const {name, username, password, userType} = req.body;
        if (userType === "student"){
            const user = new Student({name, username});
            const registeredStudent = await Student.register(user, password);
            req.login(registeredStudent, err => {
                if (err) return next(err);
                console.log(registeredStudent);
            res.redirect("/student");
            })
        } else if (userType === "professor"){
            const user = new Teacher({name, username});
            const registeredTeacher = await Teacher.register(user, password);
            req.login(registeredTeacher, err => {
                if (err) return next(err);
                console.log(registeredTeacher);
            res.redirect("/teacher");
            })
        }
               
    } catch (e) {
        console.log(e);
        res.redirect("/register")
    }
  
})

app.get("/login", (req, res) => {
    res.render("login");
})

app.get("/logout", (req, res) => {
    req.logout((err) => {
        if(err) {return next(err)}
        res.redirect("/");
    });
  
})
/*
app.post("/login", passport.authenticate('local', {failureRedirect: '/'}), (req, res) => {
    console.log("in login route req.user is ", req.user);
    const redirectUrl = req.session.returnTo || '/board';
    
    delete req.session.returnTo;
    res.redirect(redirectUrl);
})
*/

/*
app.post('/login', (req, res) => {
    if (req.body.userType === 'student') {
        passport.authenticate('studentLocal', () => {
            if (err) { return next(err); }
      if (!user) { return res.redirect('/login'); }
      req.logIn(user, function(err) {
        if (err) { return next(err); }
        return res.redirect('/dashboard');
        })
    })
}})
*/


app.post('/login', (req, res) => {
    console.log('login route')
    if (req.body.userType === 'student') {
        console.log('student')
        passport.authenticate('studentLocal')(req, res, function () {
            const redirectUrl = req.session.returnTo || '/'
            res.redirect(redirectUrl);
          });
       
       
    } else if (req.body.userType === 'teacher') {
        console.log('teacher')
        passport.authenticate('teacherLocal')(req, res, function () {
            const redirectUrl = req.session.returnTo || '/'
            res.redirect(redirectUrl);
          });
    }
})


app.get("/group", async (req, res) => {
    const students = await Student.find({});
    res.render('addgroup', {students});
})

app.post("/group", async (req, res) => {
    console.log('in add grooup');
    console.log(req.body);

    /*let s1 = await Student.findOne({username: req.body.students[0]});
    console.log('s1 is ', s1);

    let s2 = await Student.findOne({username: req.body.students[1]});
    console.log('s2 is ', s2);
    */

    const group = new Group(req.body);
    console.log('the group ', group);
    await group.save()
    res.redirect("/groups");
})

app.get("/groups", async (req, res) => {
    const groups = await Group.find({});
    res.render("groups", {groups})
})

app.get("/groups/:id", async (req, res) => {
    const group = await Group.findById(req.params.id);
    res.render("showGroup", { group })
})

app.get('/groups/:id/students/new', async (req, res) => {
    const students = await Student.find({});
    const { id } = req.params;
    res.render('addstudent', {id, students});
})

app.post("/groups/:id/students", async (req, res) => {
    const { id } = req.params;
    const group = await Group.findById(id);
    const { student1, student2 } = req.body;
    console.log('students ', req.body);
    const stud1 = await Student.findOne({ username: student1})
    const stud2 = await Student.findOne({ username: student2})
    group.student1 = stud1
    group.student2 = stud2
    await group.save()
    res.send(group);

})

app.post("/rooms/:id/urls", async (req, res) => {
    const {id} = req.params;
    console.log('id is this ', id);
    const group = await Group.findById(id);
   // res.send('post route');


    try{
        console.log('in post request');
        const imageUrl = req.body.imageUrl;
        
        group.imageUrls.push(imageUrl);
        await group.save();
        console.log('updated group is ', group);
        res.redirect(`/rooms/${id}/story`);
       
    } catch (e) {
        console.log(e);
        res.status(500).send({e});
    }


//  res.render("story.ejs");

    //res.render("story.ejs");
})


app.get("/rooms/:id/urls", async (req, res) => {
    console.log('get urls request')
    const {id} = req.params;
    console.log('id is this ', id);
    const group = await Group.findById(id);

    console.log('the group here is ', group);
    res.render('urls', {group});
})

app.post("/rooms/:id/urls/story", async (req, res) => {
    console.log('submit story route');
    const {id} = req.params;
    const group = await Group.findById(id);

    try{
        const story = req.body.story;
        group.story = story;
        await group.save();
        console.log('updated group is ', group);
        res.redirect('finishedStory');
    } catch (e) {
        console.log(e);
        res.status(500).send({e});

    }
})

app.get("/", (req, res) => {
    res.render('home');
}
);

app.get("/board", isLoggedIn, (req, res) => {
    res.render('board');
}
);

app.get("/rooms", isLoggedIn, async (req, res) => {
    console.log('in rooms ', req.user);
    if(req.user.userType === "student"){
       
           const group = await Group.findOne({ $or: [{ student1: req.user._id}, { student2: req.user._id}]});
           console.log('users group is ', group)
           res.render('rooms.ejs', {group});
        
        
    }
    
})

app.get("/student", isLoggedIn, (req, res) => {
    res.render("student.ejs")
})

app.get("/teacher", isLoggedIn, (req, res) => {
    res.render("teacher.ejs");
})

app.get("/timer", (req, res) => {

    console.log("timer over");
    res.render("timer.ejs");

})

app.get("/finishedQuiz", (req, res) => {
    const myMinutes = req.query.myMinutes;
    const mySeconds = req.query.mySeconds;
    const score = req.query.score;
    console.log('From finished quiz route: end time ', myMinutes, mySeconds);
    console.log('from finished quiz: score ', score);
    const quizLength = questions.length;
    res.render("finishedQuiz.ejs", {myMinutes, mySeconds, score, quizLength})
})

app.get("/rooms/:id", async (req, res) => {
    console.log(req.params.id);
    const group = await Group.findById(req.params.id);
    console.log('group in rounds is ', group);
    res.render("rounds.ejs", { group });
})

app.get("/rooms/:id/start", async (req, res) => {
    console.log('id is ', req.params.id);
    const group = await Group.findById(req.params.id);
    console.log('group: ', group);
    
        res.render("start.ejs", {group});
    
})

app.get("/rooms/:id/startQuiz", async (req, res) => {
    const {id} = req.params;
    console.log('id is this ', id);
    const group = await Group.findById(id);
    console.log('group passed to group1.ejs ', group)
    res.render("group1.ejs", { group });
})

app.get("/rooms/:id/story", async (req, res) => {
    const {id} = req.params;
    console.log('id is this ', id);
    const group = await Group.findById(id);
    res.render("story.ejs", { group });
})

/*
app.get("/group1", (req, res) => {
    res.render('rounds.ejs');
//    res.render("start.ejs");
})



app.get("/roundStart", (req, res) => {

    res.render('group1.ejs', {room: "group1"});
})

app.get("/group2", (req, res) => {
    res.render('rounds.ejs');
})
*/

app.post("/chat", async (req, res) => {
    try{
        console.log('in post request');
        const prompt = req.body.prompt;
        const response = await openai.createCompletion({
            model: "text-babbage-001",
  prompt: `${prompt}`,
  temperature: 0,
  max_tokens: 100,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
           
        });

        res.status(200).send({
            bot: response.data.choices[0].text
        })
    } catch (e) {
        console.log(e);
        res.status(500).send({e});
    }
})

app.post("/", async (req, res) => {
    const {prompt, size} = req.body;

    const imageSize = size === 'small' ? '256x256' : size === 'medium' ? '512x512' : '1024x1024';

    try{
        const response = await openai.createImage({
            prompt,
            n: 1,
            size: imageSize
        });

        const imageUrl = response.data.data[0].url

        res.status(200).json({
            success: true,
            data: imageUrl
        });
    } catch (error) {
        res.status(400).json({
            success: true,
            error: 'image not generated'
        })
    }
})



app.post("/urls", async (req, res) => {
    const {url1, url2, url3} = req.body;

    console.log('urls are ', url1, url2, url3)
    res.redirect("/urls");
})

app.get("/urls", async (req, res) => {
    const group = await Group.find({});
    res.render("/urls", {group});
})



const questions = [
    {question: "What is the capital of France?", answers: [
        {text: "Paris", correct: true},
        {text: "London", correct: false},
        {text: "Berlin", correct: false}]},
    {question: "What is the largest planet in our solar system?", answers: [
        {text: "Mars", correct: false}, {text: "Jupiter", correct: true}, {text: "Saturn", correct: false}]}, 
    {question: "What is the highest mountain in the world?", answers: [
        {text: "Everest", correct: true}, {text: "B", correct: false}, {text: "C", correct: false}]}
];

let currentQuestionIndex = 0;
let score = 0;

let connections = [];

const users = {}


io.on('connection', (socket) => {
    console.log('a client connected');
    //connections.push(socket);

    socket.on('join', (data) => {
        
        socket.join(data.room);        
        
        io.to(data.room).emit('firstLoadQuestions', questions);
    })

    socket.on('submitQuestion', (sendData) => {
        console.log('Data ', sendData.data);
        console.log('Id ', sendData.elementId);
        console.log('Prompt ', sendData.myPrompt);
        socket.broadcast.emit('broadcastAnswer', sendData);
    })

    socket.on('roundOne', (data) => {
        console.log('roundone event')
        socket.broadcast.emit('roundOne', data)
    })

    socket.on('roundTwo', (data) => {
        console.log('roundtwo event')
        socket.broadcast.emit('roundTwo', data)
    })


    socket.on('click', (data) => {
        socket.broadcast.to(data.room).emit('updateTimer', data);
    })

    socket.on('time', data => {
        socket.broadcast.emit('displayTime', data);
    })

  /*

    socket.on('new-user', ({name, room}) => {
        users[socket.id] = name;
        socket.broadcast.to(room).emit('user-connected', name);
    })


    socket.on('send-chat-message', ({message, room}) => {
        socket.broadcast.to(room).emit('chat-message', {message, name: users[socket.id]});
    })*/

   

    socket.on('resetScore', (score) => {
        score = 0;
    })

    socket.on('redirectOthers', (data) => {
        console.log('trying to redirect');
        socket.broadcast.to(data.room).emit('redirectedOthers', data)
    })

    socket.on('answer', (data) => {
                
        socket.broadcast.to(data.room).emit('updateAnswer', data);
       
        const selectedAnswer = data.selectedAnswer;
        const isCorrect = data.isCorrect;  

})

socket.on('updateScore', (isCorrect) => {
    if (isCorrect){
        score++;   
        console.log("Sore is now "+score);
}
})



socket.on('buttonClicked', (data) => {    
    socket.broadcast.to(data.room).emit('updateUi', data);
})


socket.on('handling-next-button', (data) => {    
   
    console.log('index', currentQuestionIndex);
    console.log('Questions length'+questions.length);
    let value = 0;
    if(data.currentQuestionIndex < questions.length){
        console.log('Case 1 where more questions')
        value = 0;  
        io.to(data.room).emit('loadQuestions', questions);  
        console.log('display next question');   
        return;
        }
        else{
           value = 1;
           
            socket.to(data.room).emit('score', {score, questions});

           io.to(data.room).emit('score', {score, questions});
           console.log('after emitting score from index');

          
        }
 
              
    }) 

    socket.on('formSubmit', (data) => {
        console.log(data.pId);
        console.log(data.sId);
        console.log(data.pValue);
        console.log(data.sValue);
        socket.broadcast.emit('fillDetails', data);

    })

    socket.on('generateImage', (sendData) => {
        console.log('Url ', sendData.imageUrl);
        console.log('Id ', sendData.id);
        socket.broadcast.emit('transferImage', sendData);
    })

    socket.on('startStory', (data) => {
        console.log('start story data is ', data);
        socket.broadcast.to(data.room).emit('copyStory', (data));
    })

    socket.on('showUrl', (data) => {
        console.log('show url index ')
        socket.broadcast.to(data.room).emit('showingUrl', data)
    })

 
    socket.on('disconnect', (data) => {
        console.log('a user disconnected');
        socket.broadcast.to(data.room).emit('user-disconnected', users[socket.id]);
        delete users[socket.id];
       
        /*connections = connections.filter((con) => {
            con.id !== socket.id;
        })
        */
    })
})


http.listen(3000, () => {
    console.log('server is running...');
})