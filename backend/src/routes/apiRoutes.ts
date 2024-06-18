import express from "express";
import multer from "multer";
import uploadConfig from "../config/upload";

import * as ApiController from "../controllers/ApiController";
import isAuthApi from "../middleware/isAuthApi";

const upload = multer(uploadConfig);

const ApiRoutes = express.Router();

ApiRoutes.post("/send", isAuthApi, upload.array("medias"), ApiController.index);

ApiRoutes.post("/", isAuthApi, ApiController.getAllTickets);

ApiRoutes.post("/v2", isAuthApi, ApiController.getMessages);

ApiRoutes.post("/v3", isAuthApi, ApiController.getMessagesTicket);


export default ApiRoutes;
