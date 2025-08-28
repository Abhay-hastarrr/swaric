// Removed circular import to fix dependency issue

const createNewPlayer = (scene, user, phaserPlayers, otherPlayers) => {
    // Add a new player sprite to the game
    const newPlayer = scene.physics.add.sprite(500, 0, 'dude').setScale(0.1);
    newPlayer.setCollideWorldBounds(true);
    phaserPlayers[user.socketId] = newPlayer;

    const newPlayerText = scene.add.text(
        newPlayer.x,
        newPlayer.y - 25,
        user.name, // Display username
        { font: "16px Arial", fill: "#ffffff" }
    ).setOrigin(0.5);

    otherPlayers.set(user.socketId, { sprite: newPlayer, text: newPlayerText });
    return newPlayer;
};

const userDisconnected = (socketIdUser, phaserPlayers, otherPlayers) => {
    console.log("player disconnector");
    if (phaserPlayers[socketIdUser]) {
        // console.log(phaserPlayers[socketIdRef]);
        phaserPlayers[socketIdUser].destroy();
        delete phaserPlayers[socketIdUser];

        console.log(`Player disconnected: ${socketIdUser}`);
    }

    if(otherPlayers.has(socketIdUser)) {
        if(otherPlayers.get(socketIdUser).text) {
            otherPlayers.get(socketIdUser).text.destroy();
        }

        otherPlayers.delete(socketIdUser);
    }
}

const playerMove = (data, phaserPlayers, otherPlayers) => {
    const { socketId, x, y } = data;
    if (phaserPlayers[socketId]) {
        if (x < phaserPlayers[socketId].x) {
            phaserPlayers[socketId].anims.play('left', true);
        } else if (x > phaserPlayers[socketId].x) {
            phaserPlayers[socketId].anims.play('right', true);
        } else if (y < phaserPlayers[socketId].y) {
            phaserPlayers[socketId].anims.play('up', true);
        } else if (y > phaserPlayers[socketId].y) {
            phaserPlayers[socketId].anims.play('down', true);
        } else {
            phaserPlayers[socketId].anims.stop();
        }

        // Update player position
        phaserPlayers[socketId].x = x;
        phaserPlayers[socketId].y = y;

        // Update username text position
        if (otherPlayers.has(socketId) && otherPlayers.get(socketId).text) {
            otherPlayers.get(socketId).text.x = x;
            otherPlayers.get(socketId).text.y = y - 25;
        }
    }
};

export { createNewPlayer, playerMove, userDisconnected };