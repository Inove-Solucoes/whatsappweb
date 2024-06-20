import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import Contact from "../../models/Contact";
const { fn, col, Op, where  } = require('sequelize');

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
interface ResponseMessageV3 {
  contactNumber: string;
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
  date
}: RequestMessage): Promise<ResponseMessageV3[]> => {

  if (!searchParam) {
    throw new Error('SearchParam is required');
  }

  if (!date) {
    throw new Error('Date is required');
  }
  const tickets = await Ticket.findAll({
    where: {
      updatedAt: {
        [Op.gte]: new Date(date),
        [Op.lt]: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
      }
    }
  });

  const contactIds = [...new Set(tickets.map(ticket => ticket.contactId))];
  
  let messagesByContact = [];

  for (const contactId of contactIds) {
    const contact = await Contact.findOne({ where: { id: contactId } });

    if (contact) {
      const contactTickets = tickets.filter(ticket => ticket.contactId === contact.id);

      const { count, rows: messages } = await Message.findAndCountAll({
        where: {
          ticketId: { 
            [Op.in]: contactTickets.map(ticket => ticket.id) 
          },
          createdAt: {
            [Op.gte]: new Date(date),
            [Op.lt]: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
          },
          [Op.and]: [
            where(fn('LOWER', col('body')), {
              [Op.like]: `%${searchParam.toLowerCase().trim()}%`
            })
          ]
        },
        order: [["createdAt", "DESC"]],
        limit: 2000
      });

      if (count > 0) {
        messagesByContact.push({
          contactNumber: contact.number,
          messages: messages.reverse(),
          count
        });
      }
    }
  }
  
  return messagesByContact;
};
export default ListMessagesService;
