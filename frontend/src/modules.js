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
        const playerData = otherPlayers.get(socketIdUser);
        playerData.sprite.destroy();
        playerData.text.destroy();
        otherPlayers.delete(socketIdUser);
    }
};

const playerMove = (data, phaserPlayers, otherPlayers) => {
    if (phaserPlayers[data.socketId]) {
        // Update player position
        phaserPlayers[data.socketId].x = data.x;
        phaserPlayers[data.socketId].y = data.y;

        // Update player animation based on velocity
        if (data.velocityX > 0) {
            phaserPlayers[data.socketId].anims.play('right', true);
        } else if (data.velocityX < 0) {
            phaserPlayers[data.socketId].anims.play('left', true);
        } else {
            phaserPlayers[data.socketId].anims.play('turn', true);
        }

        // Update the text position to follow the player
        if (otherPlayers.has(data.socketId)) {
            const playerData = otherPlayers.get(data.socketId);
            playerData.text.x = phaserPlayers[data.socketId].x;
            playerData.text.y = phaserPlayers[data.socketId].y - 25;
        }
    }
};

export { createNewPlayer, playerMove, userDisconnected };