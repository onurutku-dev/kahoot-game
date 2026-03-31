const ALL_QUESTIONS = [
  // ===== ITALY (10) =====
  {
    id: 1, country: "Italy", flag: "it",
    question: "What is the capital of Italy?",
    options: ["Milan", "Rome", "Naples", "Florence"],
    correct: 1
  },
  {
    id: 2, country: "Italy", flag: "it",
    question: "Which Italian city is famous for its canals and gondolas?",
    options: ["Florence", "Venice", "Naples", "Genoa"],
    correct: 1
  },
  {
    id: 3, country: "Italy", flag: "it",
    question: "The Carnival of Venice is best known for its elaborate…",
    options: ["Fireworks", "Masks", "Parades of horses", "Flower floats"],
    correct: 1
  },
  {
    id: 4, country: "Italy", flag: "it",
    question: "Which Italian city is called the birthplace of the Renaissance?",
    options: ["Rome", "Venice", "Florence", "Milan"],
    correct: 2
  },
  {
    id: 5, country: "Italy", flag: "it",
    question: "In which city is the famous Leaning Tower located?",
    options: ["Rome", "Milan", "Pisa", "Turin"],
    correct: 2
  },
  {
    id: 6, country: "Italy", flag: "it",
    question: "La Befana is a legendary Italian figure who delivers gifts on…",
    options: ["Christmas Eve", "Easter", "Epiphany (January 6)", "New Year's Day"],
    correct: 2
  },
  {
    id: 7, country: "Italy", flag: "it",
    question: "Tarantella is a traditional Italian…",
    options: ["Dessert", "Folk dance", "Musical instrument", "Painting style"],
    correct: 1
  },
  {
    id: 8, country: "Italy", flag: "it",
    question: "Which is the largest Mediterranean island belonging to Italy?",
    options: ["Sardinia", "Sicily", "Capri", "Elba"],
    correct: 1
  },
  {
    id: 9, country: "Italy", flag: "it",
    question: "What is 'La Scala' in Milan?",
    options: ["A football stadium", "An opera house", "A cathedral", "A royal palace"],
    correct: 1
  },
  {
    id: 10, country: "Italy", flag: "it",
    question: "Throwing a coin into the Trevi Fountain is said to ensure you will…",
    options: ["Find true love", "Return to Rome", "Have good luck for a year", "Become wealthy"],
    correct: 1
  },

  // ===== BULGARIA (10) =====
  {
    id: 11, country: "Bulgaria", flag: "bg",
    question: "What is the capital of Bulgaria?",
    options: ["Plovdiv", "Sofia", "Varna", "Burgas"],
    correct: 1
  },
  {
    id: 12, country: "Bulgaria", flag: "bg",
    question: "What is a 'Martenitsa' in Bulgarian tradition?",
    options: ["A traditional cake", "A red-and-white thread ornament exchanged on March 1st", "A folk song", "A type of embroidery"],
    correct: 1
  },
  {
    id: 13, country: "Bulgaria", flag: "bg",
    question: "Kukeri performers wear elaborate costumes and masks to…",
    options: ["Celebrate a wedding", "Scare away evil spirits", "Welcome foreign guests", "Mark the harvest season"],
    correct: 1
  },
  {
    id: 14, country: "Bulgaria", flag: "bg",
    question: "Which Bulgarian city was the European Capital of Culture in 2019?",
    options: ["Sofia", "Plovdiv", "Varna", "Veliko Tarnovo"],
    correct: 1
  },
  {
    id: 15, country: "Bulgaria", flag: "bg",
    question: "Bulgaria is one of the world's top producers of which flower's essential oil?",
    options: ["Lavender", "Rose", "Sunflower", "Tulip"],
    correct: 1
  },
  {
    id: 16, country: "Bulgaria", flag: "bg",
    question: "What is the traditional Bulgarian pastry 'Banitsa' made with?",
    options: ["Corn flour and honey", "Filo dough and white cheese", "Rye bread and meat", "Puff pastry and spinach"],
    correct: 1
  },
  {
    id: 17, country: "Bulgaria", flag: "bg",
    question: "What is the traditional Bulgarian circle dance called?",
    options: ["Polka", "Horo", "Tango", "Waltz"],
    correct: 1
  },
  {
    id: 18, country: "Bulgaria", flag: "bg",
    question: "Nestinarstvo is the Bulgarian tradition of dancing barefoot on…",
    options: ["Ice", "Hot embers", "Water", "Sand"],
    correct: 1
  },
  {
    id: 19, country: "Bulgaria", flag: "bg",
    question: "Which famous Bulgarian monastery is a UNESCO World Heritage Site?",
    options: ["Bachkovo Monastery", "Rila Monastery", "Troyan Monastery", "Rozhen Monastery"],
    correct: 1
  },
  {
    id: 20, country: "Bulgaria", flag: "bg",
    question: "Bulgarian yogurt is world-famous for containing which unique bacterium?",
    options: ["Saccharomyces", "Lactobacillus bulgaricus", "Bifidobacterium", "Streptococcus thermophilus"],
    correct: 1
  },

  // ===== ROMANIA (10) =====
  {
    id: 21, country: "Romania", flag: "ro",
    question: "What is the capital of Romania?",
    options: ["Cluj-Napoca", "Bucharest", "Timișoara", "Iași"],
    correct: 1
  },
  {
    id: 22, country: "Romania", flag: "ro",
    question: "Which Romanian region is famously associated with the legend of Count Dracula?",
    options: ["Wallachia", "Transylvania", "Moldavia", "Dobruja"],
    correct: 1
  },
  {
    id: 23, country: "Romania", flag: "ro",
    question: "Bran Castle in Romania is popularly known as…",
    options: ["The Royal Palace", "Dracula's Castle", "The Black Fortress", "The Iron Gate"],
    correct: 1
  },
  {
    id: 24, country: "Romania", flag: "ro",
    question: "Mărțișor is a Romanian spring tradition celebrated on…",
    options: ["January 1st", "March 1st", "May 1st", "June 1st"],
    correct: 1
  },
  {
    id: 25, country: "Romania", flag: "ro",
    question: "What is the traditional Romanian dish 'Sarmale'?",
    options: ["Grilled sausages", "Cabbage rolls stuffed with meat and rice", "Bean soup", "Cheese pie"],
    correct: 1
  },
  {
    id: 26, country: "Romania", flag: "ro",
    question: "Mămăligă is a traditional Romanian dish similar to…",
    options: ["Rice pudding", "Italian polenta", "French crepes", "Greek moussaka"],
    correct: 1
  },
  {
    id: 27, country: "Romania", flag: "ro",
    question: "The 'Ie' is a traditional Romanian…",
    options: ["Dance", "Embroidered blouse", "Musical instrument", "Holiday"],
    correct: 1
  },
  {
    id: 28, country: "Romania", flag: "ro",
    question: "Hora is a traditional Romanian…",
    options: ["Dessert", "Circle dance", "Soup", "Hat"],
    correct: 1
  },
  {
    id: 29, country: "Romania", flag: "ro",
    question: "The Painted Monasteries of Bucovina are famous for their…",
    options: ["Gold domes", "Exterior wall frescoes", "Underground tunnels", "Stained glass windows"],
    correct: 1
  },
  {
    id: 30, country: "Romania", flag: "ro",
    question: "Dragobete is the Romanian equivalent of…",
    options: ["Thanksgiving", "Valentine's Day", "Halloween", "Independence Day"],
    correct: 1
  },

  // ===== TURKEY (10) =====
  {
    id: 31, country: "Turkey", flag: "tr",
    question: "What is the capital of Turkey?",
    options: ["Istanbul", "Ankara", "Izmir", "Antalya"],
    correct: 1
  },
  {
    id: 32, country: "Turkey", flag: "tr",
    question: "Hagia Sophia in Istanbul was originally built as a…",
    options: ["Mosque", "Christian cathedral", "Royal palace", "Library"],
    correct: 1
  },
  {
    id: 33, country: "Turkey", flag: "tr",
    question: "Turkish Delight (Lokum) is traditionally flavored with…",
    options: ["Chocolate", "Rosewater", "Vanilla", "Caramel"],
    correct: 1
  },
  {
    id: 34, country: "Turkey", flag: "tr",
    question: "The Whirling Dervishes tradition originated in which Turkish city?",
    options: ["Istanbul", "Konya", "Ankara", "Bursa"],
    correct: 1
  },
  {
    id: 35, country: "Turkey", flag: "tr",
    question: "Cappadocia is famous for its unique…",
    options: ["Beaches and resorts", "Fairy chimneys and hot air balloon rides", "Rainforests", "Ancient pyramids"],
    correct: 1
  },
  {
    id: 36, country: "Turkey", flag: "tr",
    question: "What is a traditional Turkish bathhouse called?",
    options: ["Sauna", "Hamam", "Spa", "Onsen"],
    correct: 1
  },
  {
    id: 37, country: "Turkey", flag: "tr",
    question: "Karagöz and Hacivat are characters from traditional Turkish…",
    options: ["Opera", "Shadow puppet theater", "Ballet", "Stand-up comedy"],
    correct: 1
  },
  {
    id: 38, country: "Turkey", flag: "tr",
    question: "Kırkpınar Oil Wrestling Festival is one of the world's oldest…",
    options: ["Dance festivals", "Sporting competitions", "Music events", "Food fairs"],
    correct: 1
  },
  {
    id: 39, country: "Turkey", flag: "tr",
    question: "Ebru is the traditional Turkish art of…",
    options: ["Calligraphy", "Paper marbling", "Pottery", "Carpet weaving"],
    correct: 1
  },
  {
    id: 40, country: "Turkey", flag: "tr",
    question: "Pamukkale, meaning 'Cotton Castle,' features natural…",
    options: ["Sand dunes", "White travertine terraces", "Waterfalls", "Coral reefs"],
    correct: 1
  }
];
