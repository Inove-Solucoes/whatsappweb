import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import Contact from "../../models/Contact";
import { Op } from 'sequelize';

interface Request {
  ticketId: string;
  pageNumber?: string;
}

interface RequestMessage {
  searchParam?: string;
  contactNumber?: string;
  date?: string;
}

interface ResponseMessage {
  messages: Message[];
  count: number;
}

interface Response {
  messages: Message[];
  ticket: Ticket;
  count: number;
  hasMore: boolean;
}

const ListMessagesService = async ({
  pageNumber = "1",
  ticketId
}: Request): Promise<Response> => {
  const ticket = await ShowTicketService(ticketId);

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // await setMessagesAsRead(ticket);
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: messages } = await Message.findAndCountAll({
    where: { ticketId },
    limit,
    include: [
      "contact",
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ],
    offset,
    order: [["createdAt", "DESC"]]
  });

  const hasMore = count > offset + messages.length;

  return {
    messages: messages.reverse(),
    ticket,
    count,
    hasMore
  };
};

export const ListMessagesServiceV2 = async ({
  searchParam,
  contactNumber,
  date
}: RequestMessage): Promise<ResponseMessage> => {

  let whereClause = {};

  if (date) {
    whereClause = {
      ...whereClause,
      '$message.createdAt$': {
        [Op.gte]: new Date(date),
        [Op.lt]: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
      }
    };
  }

  if (searchParam) {
    whereClause = {
      ...whereClause,
      '$message.body$': {
        [Op.like]: `%${searchParam.toLowerCase().trim()}%`
      }
    };

  }
  if (contactNumber) {
    whereClause = {
      ...whereClause,
      '$contact.number$': {
        [Op.eq]: contactNumber
      }
    };
  }

  const limit = 200;
  const { count, rows: messages } = await Message.findAndCountAll({
    where: whereClause,
    limit,
    include: ["contact"],
    order: [["createdAt", "DESC"]]
  });

  return {
    messages: messages.reverse(),
    count
  };
};

export const ListMessagesServiceV3 = async ({
  searchParam,
  contactNumber,
  date
}: RequestMessage): Promise<ResponseMessage> => {

  if (!contactNumber) {
    throw new Error('Contact number is required');
  } 
  
  if (!searchParam) {
    throw new Error('SearchParam is required');
  }

  if(!date){
    throw new Error('Date is required');
  }

  const contact = await Contact.findOne({ where: { number: contactNumber } });
  if (!contact) {
    throw new Error('Contact not found');
  }

  // Buscar todos os tickets associados ao contato
  const tickets = await Ticket.findAll({ where: { contactId: contact.id } });

  // Sequelize query
  const { count, rows: messages } = await Message.findAndCountAll({
    where: { ticketId: { [Op.in]: tickets.map(ticket => ticket.id) },
    [Op.and]: [
      { body: { [Op.like]: `%${searchParam.toLowerCase().trim()}%` } },
      { createdAt: {
        [Op.gte]: new Date(date),
        [Op.lt]: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
      }}
    ]},
    order: [["createdAt", "DESC"]],
    limit: 200
  });
  
  return {
    messages: messages.reverse(),
    count
  };
};
export default ListMessagesService;
