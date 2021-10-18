import type { NextApiRequest, NextApiResponse } from "next";

import { getSession } from "@lib/auth";

import { IntegrationCalendar, listCalendars } from "../../../lib/calendarClient";
import prisma from "../../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req: req });

  if (!session?.user?.id) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      credentials: true,
      timeZone: true,
      id: true,
    },
  });

  if (!currentUser) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  if (req.method == "POST") {
    await prisma.selectedCalendar.upsert({
      where: {
        userId_integration_externalId: {
          userId: currentUser.id,
          integration: req.body.integration,
          externalId: req.body.externalId,
        },
      },
      create: {
        userId: currentUser.id,
        integration: req.body.integration,
        externalId: req.body.externalId,
      },
      // already exists
      update: {},
    });
    res.status(200).json({ message: "Calendar Selection Saved" });
  }

  if (req.method == "DELETE") {
    await prisma.selectedCalendar.delete({
      where: {
        userId_integration_externalId: {
          userId: currentUser.id,
          externalId: req.body.externalId,
          integration: req.body.integration,
        },
      },
    });

    res.status(200).json({ message: "Calendar Selection Saved" });
  }

  if (req.method == "GET") {
    const selectedCalendarIds = await prisma.selectedCalendar.findMany({
      where: {
        userId: currentUser.id,
      },
      select: {
        externalId: true,
      },
    });

    const calendars: IntegrationCalendar[] = await listCalendars(currentUser.credentials);
    const selectableCalendars = calendars.map((cal) => {
      return { selected: selectedCalendarIds.findIndex((s) => s.externalId === cal.externalId) > -1, ...cal };
    });
    res.status(200).json(selectableCalendars);
  }
}
