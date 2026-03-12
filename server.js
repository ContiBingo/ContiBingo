const express = require('express');
const app = express();
const port = 3000;

// Middleware
app.use(express.json());

// Sample data
let games = [];
let players = [];

// Admin Authentication
const adminAuth = (req, res, next) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'password123') {
        next();
    } else {
        res.status(403).send('Forbidden');
    }
};

// Admin Routes
app.post('/create-game', adminAuth, (req, res) => {
    const { gameName } = req.body;
    games.push({ name: gameName, numbersCalled: [] });
    res.status(201).send(`Game ${gameName} created.`);
});

// Player Registration
app.post('/register', (req, res) => {
    const { playerName } = req.body;
    players.push({ name: playerName });
    res.status(201).send(`Player ${playerName} registered.`);
});

// Number Calling
app.post('/call-number', (req, res) => {
    const { number, gameName } = req.body;
    const game = games.find(g => g.name === gameName);
    if (game) {
        game.numbersCalled.push(number);
        res.status(200).send(`Number ${number} called in ${gameName}.`);
    } else {
        res.status(404).send('Game not found.');
    }
});

// Stamping
app.post('/stamp', (req, res) => {
    const { playerName, gameName, number } = req.body;
    const game = games.find(g => g.name === gameName);
    if (game && game.numbersCalled.includes(number)) {
        res.status(200).send(`Player ${playerName} stamped number ${number} in ${gameName}.`);
    } else {
        res.status(404).send('Game not found or number not called.');
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
