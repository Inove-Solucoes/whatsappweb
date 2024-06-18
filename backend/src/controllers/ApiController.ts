import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import Message from "../models/Message";
import Whatsapp from "../models/Whatsapp";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import GetProfilePicUrl from "../services/WbotServices/GetProfilePicUrl";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import { ListMessagesServiceV2 } from "../services/MessageServices/ListMessagesService";
import { ListMessagesServiceV3 } from "../services/MessageServices/ListMessagesService";

interface RequestTicket{
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  showAll?: string;
  userId: string;
  withUnreadMessages?: string;
  queueIds: number[];
  contactNumber: string;
}

interface RequestMessages{
  searchParam?: string;
  date?: string;
  contactNumber: string;
}

interface ResponseMessageV3 {
  contactNumber: string;
  messages: Message[];
  count: number;
}
type WhatsappData = {
  whatsappId: number;
}

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
};

interface ContactData {
  number: string;
}

const createContact = async (
  whatsappId: number | undefined,
  newContact: string
) => {
  await CheckIsValidContact(newContact);

  const validNumber: any = await CheckContactNumber(newContact);

  const profilePicUrl = await GetProfilePicUrl(validNumber);

  const number = validNumber;

  const contactData = {
    name: `${number}`,
    number,
    profilePicUrl,
    isGroup: false
  };

  const contact = await CreateOrUpdateContactService(contactData);

  let whatsapp:Whatsapp | null;

  if(whatsappId === undefined) {
    whatsapp = await GetDefaultWhatsApp();
  } else {
    whatsapp = await Whatsapp.findByPk(whatsappId);

    if(whatsapp === null) {
      throw new AppError(`whatsapp #${whatsappId} not found`);
    }
  }

  const createTicket = await FindOrCreateTicketService(
    contact,
    whatsapp.id,
    1
  );

  const ticket = await ShowTicketService(createTicket.id);

  SetTicketMessagesAsRead(ticket);

  return ticket;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const newContact: ContactData = req.body;
  const { whatsappId }: WhatsappData = req.body;
  const { body, quotedMsg }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];

  newContact.number = newContact.number.replace("-", "").replace(" ", "");

  const schema = Yup.object().shape({
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const contactAndTicket = await createContact(whatsappId, newContact.number);

  if (medias) {
    await Promise.all(
      medias.map(async (media: Express.Multer.File) => {
        await SendWhatsAppMedia({ body, media, ticket: contactAndTicket });
      })
    );
  } else {
    await SendWhatsAppMessage({ body, ticket: contactAndTicket, quotedMsg });
  }

  setTimeout(async () => {
await UpdateTicketService({ticketId: contactAndTicket.id,ticketData: { status: "closed" }});}, 1000);
return res.send({ error: "SUCCESS" });
};

export const getAllTickets = async (req: Request, res: Response): Promise<Response> => {
  
  
  const {
    searchParam,
    pageNumber,
    status,
    date,
    showAll,
    userId,
    withUnreadMessages,
    contactNumber
  }: RequestTicket = req.body;


  const {tickets, count, hasMore} = await ListTicketsService({
    searchParam,
    pageNumber,
    status,
    date,
    showAll,
    userId,
    withUnreadMessages,
    queueIds: [1,2,3,4,5,6,7,8],
    contactNumber
  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const getMessages = async (req: Request, res: Response): Promise<Response> => {
  
  const {
    searchParam,
    date,
    contactNumber
  }: RequestMessages = req.body;


  const {messages, count} = await ListMessagesServiceV2({
    searchParam,
    date,
    contactNumber
  });

  return res.status(200).json({ messages, count });
};

export const getMessagesTicket = async (req: Request, res: Response): Promise<Response<ResponseMessageV3[]>> => {
  const {
    searchParam,
    date,
    contactNumber
  }: RequestMessages = req.body;


  const messages  = await ListMessagesServiceV3({
    searchParam,
    date,
    contactNumber
  });

  return res.status(200).json({ messages });
};