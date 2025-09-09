import { User } from "../models/userModel.js";
import httpStatus from "http-status";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const login = async (req, res) => {
    let { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Please provide all required inputs" });
    }

    try {
        let user = await User.findOne({ username });

        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
        }

        let isPassCorrect = await bcrypt.compare(password, user.password);

        if(isPassCorrect) {
            let token = crypto.randomBytes(20).toString("hex");

            user.token = token;
            user.save();

            return res.status(httpStatus.OK).json({token : token, name : user.name});
        } else {
            return res.status(httpStatus.UNAUTHORIZED).json({message : "Invalid username or password"});
        }

    } catch(e) {
        return res.status(500).json({message : `something want wrong (${e})`});
    }
}

const register = async (req, res) => {
    let {username, name, password, email} = req.body;

    try {
        let existingUser = await User.findOne({username});
        
        if(existingUser) {
            return res.status(httpStatus.FOUND).json({message : "User already exists"});
        }

        let hashPass = await bcrypt.hash(password, 10);

        // Create user object with email only if it's provided
        let userData = {name, username, password: hashPass};
        if (email) userData.email = email;
        
        let user = new User(userData);

        await user.save();

        res.status(httpStatus.CREATED).json({message : "User Registered"});
    } catch(e) {
        res.status(500).json({message : `Something went wrong (${e})`});
    }
}

export {login, register};