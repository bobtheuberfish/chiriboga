// Title: setgen
// Purpose: convert attributes and values from trusted Netrunner sources
// into Chiriboga deck set formatted JSON.
// Version: 0.02

package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

type Card struct {
	Attributes struct {
		Title      string `json:"title"`
		Id         string `json:"latest_printing_id"`
		Elo        int
		Player     string `json:"side_id"`
		Faction    string `json:"faction_id"`
		Influence  int    `json:"influence_cost"`
		Cardtype   string `json:"card_type_id"`
		Subtypes   string `json:"display_subtypes"`
		Playcost   int    `json:"cost"`
		Strength   int    `json:"strength"`
		Trashcost  int    `json:"trash_cost"`
		Memorycost int    `json:"memory_cost"`
	} `json:"attributes"`
}

type CardSet struct {
	Cards []Card `json:"data"`
}

type Ranking struct {
	Title string
	Elo   int
}

func main() {
	fmt.Print("Enter Netrunner Card Set to generate (ex: 23_seconds, parhelion, [midnight_sun]): ")
	reader := bufio.NewReader(os.Stdin)
	input, err := reader.ReadString('\n')
	if err != nil {
		fmt.Println("An error occured while reading input. ", err)
		return
	}
	input = strings.TrimSuffix(input, "\n")
	input = strings.TrimSuffix(input, "\r")
	if input == "" {
		input = "midnight_sun"
	}
	resp, err := http.Get("https://api-preview.netrunnerdb.com/api/v3/public/card_sets/" + input + "/cards")
	if err != nil {
		fmt.Println("Error making API request:", err)
		return
	}
	defer resp.Body.Close()
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		return
	}

	var cardSet CardSet
	err = json.Unmarshal(data, &cardSet)
	if err != nil {
		fmt.Println("Error decoding JSON response:", err)
		return
	}

	resp, error := http.Get("https://trash-or-busto.herokuapp.com/ranking")
	if err != nil {
		log.Fatal(error)
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		fmt.Println("Unable to create new document from reader: ", err)
	}

	var cardName, eloValue string
	var Rankings []Ranking

	doc.Find("table tbody tr").Each(func(i int, s *goquery.Selection) {
		cardName = s.Find("a").Text()
		eloValue = s.Find("td:nth-child(3)").Text()

		elo, err := strconv.Atoi(eloValue)
		if err == nil {
			ranking := Ranking{Title: cardName, Elo: elo}
			Rankings = append(Rankings, ranking)
		}
	})

	for item, card := range cardSet.Cards {
		for _, rankarray := range Rankings {
			if card.Attributes.Title == rankarray.Title {
				card.Attributes.Elo = rankarray.Elo
				cardSet.Cards[item].Attributes.Elo = rankarray.Elo
			}
		}
	}

	file, err := os.Create(input + ".json")
	if err != nil {
		fmt.Println("Error creating file: ", err)
		return
	}
	defer file.Close()
	for _, card := range cardSet.Cards {
		file.WriteString("cardSet[" + card.Attributes.Id + "] = {\n")
		file.WriteString("    title: \"" + card.Attributes.Title + "\",\n")
		file.WriteString("    imageFile: \"" + card.Attributes.Id + ".png\",\n")
		file.WriteString("    elo: " + strconv.Itoa(card.Attributes.Elo) + ",\n")
		file.WriteString("    player: " + card.Attributes.Player + ",\n")
		if card.Attributes.Faction == "nbn" {
			card.Attributes.Faction = "NBN"
		}
		if card.Attributes.Faction == "haas_bioroid" {
			card.Attributes.Faction = "Haas-Bioroid"
		}
		if card.Attributes.Faction == "weyland_consortium" {
			card.Attributes.Faction = "Weyland Consortium"
		}
		file.WriteString("    faction: \"" + capitalizeFirstLetter(card.Attributes.Faction) + "\",\n")
		file.WriteString("    influence: " + strconv.Itoa(card.Attributes.Influence) + ",\n")
		file.WriteString("    cardType: \"" + card.Attributes.Cardtype + "\",\n")
		file.WriteString("    rezCost: " + strconv.Itoa(card.Attributes.Playcost) + ",\n")
		if card.Attributes.Memorycost != 0 {
			file.WriteString("    memoryCost: " + strconv.Itoa(card.Attributes.Memorycost) + ",\n")
		}
		if card.Attributes.Trashcost != 0 {
			file.WriteString("    trashCost: " + strconv.Itoa(card.Attributes.Trashcost) + ",\n")
		}
		if card.Attributes.Strength != 0 {
			file.WriteString("    strength: " + strconv.Itoa(card.Attributes.Strength) + ",\n")
		}
		if card.Attributes.Subtypes != "" {
			file.WriteString("    subTypes: [\"")
			subtypes := strings.ReplaceAll(card.Attributes.Subtypes, " - ", "\", \"")
			file.WriteString(subtypes)
			file.WriteString("\"],\n")
		}
		file.WriteString("\n")
		file.WriteString("// Subroutines and AI Implementations Go Here\n")
		file.WriteString("\n")
		file.WriteString("}\n")
		file.WriteString("\n")
	}

	fmt.Println("Results saved in file: " + input + ".json.")
}

func capitalizeFirstLetter(s string) string {
	if len(s) == 0 {
		return s
	}
	firstChar := string(s[0])
	restOfString := s[1:]
	return fmt.Sprintf("%s%s", strings.ToUpper(firstChar), restOfString)
}
