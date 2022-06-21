import fetch from "node-fetch";
import { JSDOM } from "jsdom";

const BASE_URL = "https://www.worldcubeassociation.org";

type Dates = [startDate: Date, endDate?: Date];

export interface Competition {
  name: string;
  dates: Dates;
  location: string;
  url: string;
}

export async function fetchCompetitions(): Promise<
  [upcoming: Competition[], inProgress: Competition[]]
> {
  const response = await fetch(`${BASE_URL}/competitions`);

  const text = await response.text();

  const dom = new JSDOM(text);

  const document = dom.window.document;

  const upcomingElements = document.querySelectorAll(
    "#upcoming-comps .list-group .list-group-item.not-past"
  );
  const inProgressElements = document.querySelectorAll(
    "#in-progress-comps .list-group .list-group-item.not-past"
  );

  const upcoming: Competition[] = [];
  const inProgress: Competition[] = [];

  upcomingElements.forEach((el) => {
    const competition = getCompetitionFromElement(el);

    if (competition !== undefined) {
      upcoming.push(competition);
    }
  });

  inProgressElements.forEach((el) => {
    const competition = getCompetitionFromElement(el);

    if (competition !== undefined) {
      inProgress.push(competition);
    }
  });

  return [upcoming, inProgress];
}

function getCompetitionFromElement(el: Element): Competition | undefined {
  const dateEl = el.querySelector(".date");
  const infoEl = el.querySelector(".competition-info");
  const linkEl = infoEl?.querySelector(".competition-link a");
  const locationEl = infoEl?.querySelector(".location");

  const name = linkEl?.textContent?.trim();
  const dateString = dateEl?.textContent?.trim();
  const location = locationEl?.textContent?.trim();
  const url = linkEl?.getAttribute("href")?.trim();

  if (
    name === undefined ||
    dateString === undefined ||
    location === undefined ||
    url === undefined
  ) {
    return;
  }

  const dates = convertToDates(dateString);

  return {
    name,
    dates,
    location,
    url: `${BASE_URL}${url}`
  };
}

function convertToDates(dateString: string): Dates {
  if (dateString.includes(" - ")) {
    const simplified = dateString
      .replace(/[^0-9a-zA-Z ]/g, "")
      .replace(/ +/g, " ");

    const [month, start, end, year] = simplified.split(" ");

    const startDateString = `${month} ${start}, ${year}`;
    const endDateString = `${month} ${end}, ${year}`;

    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);

    return [startDate, endDate];
  }

  return [new Date(dateString)];
}
