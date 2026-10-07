/**
 * Name pools per country. Each list is a space-separated string to keep the file readable
 * (an underscore stands for a space inside one name, e.g. de_Jong); `pool()` splits it. Surnames follow the real naming habits of each place (e.g. Spanish and
 * Brazilian surnames are patronymic, Korean and Japanese ones are short and few).
 */
export interface NamePool {
  male: string[];
  female: string[];
  last: string[];
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).map((w) => w.replace(/_/g, " "));
const pool = (male: string, female: string, last: string): NamePool => ({ male: words(male), female: words(female), last: words(last) });

export const NAME_POOLS: Record<string, NamePool> = {
  "United States": pool(
    `James Liam Noah Ethan Mason Jacob Lucas Henry Jack Owen William Benjamin Elijah Logan Aiden Caleb Carter Wyatt Dylan Isaac Gabriel Julian Levi
     Nathan Hunter Landon Jackson Grayson Cooper Brayden Tyler Austin Dominic Tristan Miles Colton Xavier Jordan Maverick Everett Walker Beckett Ryder Zane Marcus Terrance Darnell DeShawn Tyrone Jamal Mateo Santiago Diego`,
    `Olivia Emma Ava Sophia Mia Harper Emily Grace Chloe Ella Amelia Isabella Charlotte Abigail Madison Avery Scarlett Lily Zoe Hannah Natalie Brooklyn Savannah Aubrey Penelope
     Layla Riley Nora Hazel Violet Stella Paisley Everly Maya Kennedy Delilah Naomi Eliana Willow Gianna Jasmine Tiana Imani Keisha Latoya Valentina Camila Lucia Mei`,
    `Smith Johnson Williams Brown Davis Miller Wilson Moore Taylor Anderson Thomas Jackson White Harris Martin Thompson Garcia Martinez Robinson Clark Rodriguez Lewis Lee Walker Hall Allen Young Hernandez King Wright Lopez Hill Scott Green Adams Baker Gonzalez Nelson Carter Mitchell Perez Roberts Turner Phillips Campbell Parker Evans Edwards Collins Stewart Sanchez Morris Rogers Reed Cook Morgan Bell Murphy Bailey Rivera Cooper Richardson Cox Howard Ward Torres Peterson Gray Ramirez James Watson Brooks Kelly Sanders Price Bennett Wood Barnes Ross Henderson Coleman Jenkins Perry Powell Long Patterson Hughes Flores Washington Butler Simmons Foster Gonzales Bryant Alexander Russell Griffin Hayes Nguyen Kim Patel Cohen Kowalski Ferrari O'Brien Sullivan`,
  ),
  "United Kingdom": pool(
    `Oliver George Harry Noah Jack Leo Arthur Muhammad Oscar Charlie Henry Alfie Freddie Archie Theo Thomas Jacob Finley Edward Alexander Joshua William Ronnie Sebastian Callum Rhys Dylan Ewan Fraser Angus Callan Euan Hamish Connor Declan Rory Liam Mohammed Aaron Jamie Luke Ryan Reece Kieran Bradley Dominic Rupert Hugo Barnaby Rafferty Gareth Owain Ioan Cai Tomos Seamus Siobhan`,
    `Olivia Amelia Isla Ava Mia Ivy Lily Isabella Florence Poppy Willow Sophia Grace Evie Daisy Freya Ella Charlotte Phoebe Rosie Millie Elsie Alice Harper Sienna Eleanor Imogen Matilda Maisie Esme Ruby Holly Lucy Georgia Heidi Tilly Niamh Aoife Ciara Orla Eilidh Catriona Morag Fiona Mairi Gwen Seren Bethan Carys Megan Rhiannon Zara Aisha Priya Hollie Tabitha Harriet`,
    `Smith Jones Taylor Brown Williams Wilson Johnson Davies Robinson Wright Thompson Evans Walker White Roberts Green Hall Wood Jackson Clarke Patel Khan Ahmed Lewis Hughes Edwards Turner Hill Moore Cooper Ward Morris Harrison Baker King Allen Young Scott Bennett Mitchell Phillips Campbell Stewart Murray Reid MacDonald Fraser Robertson Graham Cameron Kerr Ross Gordon Murphy Kelly O'Neill Ryan Doyle Byrne Griffiths Pugh Powell Rees Price Morgan Lloyd Bevan Pritchard Hargreaves Atkinson Fletcher Thornton Ashworth Whitmore Pemberton Carrington Hartley Sutton Beckett Okafor Singh Begum Chowdhury`,
  ),
  Canada: pool(
    `Liam Noah Lucas Ethan Jack Logan Nathan Benjamin Owen Jacob William Thomas Samuel Felix Olivier Gabriel Étienne Mathieu Alexandre Jean-Luc Hunter Carter Connor Cole Tyson Brayden Dawson Parker Griffin Tanner Ryder Callum Hudson Easton Wesley Declan Raj Arjun Harpreet Jaspreet Wei Kenji Mateo Dylan`,
    `Olivia Emma Charlotte Ava Sophia Amelia Chloe Ella Abigail Léa Camille Florence Éloïse Juliette Maëlle Zoé Emily Hannah Avery Brooklyn Piper Mackenzie Paige Brielle Kennedy Harper Nora Maya Ellie Sienna Simran Harleen Priya Mei Aiyana Willow Tessa Claire Madeleine Genevieve Josie Rowan`,
    `Smith Brown Tremblay Martin Roy Wilson MacDonald Gagnon Johnson Taylor Côté Campbell Anderson Leblanc Lee White Gauthier Wong Morin Thompson Bouchard Singh Stewart Clark Fortin Patel Gill Chen Li Sandhu Dhillon Lavoie Fraser Murray Reid Robertson Mackenzie Cameron Ross Bell Young Cormier Pelletier Bergeron Ouellet Girard Leclerc Boucher Nguyen Kaur Grewal Ferguson Walker Hughes Kowalchuk Yeung Bouchard`,
  ),
  Australia: pool(
    `Oliver Noah Jack William Leo Charlie Henry Lucas Thomas Hudson Mason Archie Harrison Ethan Max Hunter Cooper Jackson Lachlan Angus Callum Riley Flynn Harvey Jasper Finn Xavier Beau Koby Tyson Mitchell Brodie Darcy Banjo Rory Jarrah Kai Matilda Wiremu Tane Hemi Nikau Rawiri Ashton Zac Dean`,
    `Charlotte Amelia Olivia Mia Isla Ava Ella Grace Chloe Matilda Ruby Willow Harper Evie Sophie Lily Zoe Sienna Hayley Indi Tahlia Maddison Kaitlyn Bronte Tamika Imogen Poppy Georgia Lucy Piper Frankie Milla Pippa Jorja Shelby Kirra Maia Aroha Anika Zara Keira Esther`,
    `Smith Jones Williams Brown Wilson Taylor Johnson White Martin Anderson Thompson Nguyen Thomas Walker Harris Lee Ryan Robinson Kelly King Davis Wright Evans Roberts Green Hall Wood Jackson Clarke Patel Murray Hughes Edwards Turner Mitchell Campbell Stewart Cooper Morris Baker Allen Young Scott Bennett Fraser Reid Ross Gordon Murphy O'Brien Collins Singh Chen Wang Tran Pham Papadopoulos Rossi Kovac Ngata Parata Tamihana`,
  ),
  Germany: pool(
    `Noah Matteo Elias Finn Leon Paul Ben Luis Felix Jonas Lukas Maximilian Emil Henri Anton Theo Oskar Moritz Nico Tim Jan Niklas Tobias Florian Sebastian Fabian Philipp Johannes Dominik Kevin Lars Jannik Hendrik Stefan Andreas Thomas Markus Michael Klaus Jürgen Wolfgang Heinz Dieter Uwe Rainer Ali Emre Murat`,
    `Emilia Sophia Emma Hannah Mia Lina Ella Lea Clara Mila Marie Lotta Johanna Charlotte Amelie Luisa Frieda Ida Greta Nele Pia Jana Laura Anna Katharina Julia Lena Sarah Nina Sabine Petra Monika Birgit Ursula Renate Gisela Heike Ayşe Elif Zeynep Anja Franziska Svenja`,
    `Müller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann Schäfer Koch Bauer Richter Klein Wolf Schröder Neumann Schwarz Zimmermann Braun Krüger Hofmann Hartmann Lange Schmitt Werner Schmitz Krause Meier Lehmann Schmid Schulze Maier Köhler Herrmann König Walter Mayer Huber Kaiser Fuchs Peters Lang Scholz Möller Weiß Jung Hahn Schubert Vogel Friedrich Keller Günther Frank Berger Winkler Roth Beck Lorenz Baumann Franke Albrecht Schuster Simon Ludwig Böhm Winter Kraus Martin Schumacher Krämer Vogt Yilmaz Kaya Demir`,
  ),
  France: pool(
    `Gabriel Léo Raphaël Arthur Louis Lucas Adam Jules Hugo Maël Liam Ethan Noah Paul Tom Théo Nathan Sacha Mathis Antoine Baptiste Clément Maxime Alexandre Nicolas Julien Pierre Thibault Quentin Romain Florian Guillaume Étienne Olivier Laurent Philippe Jean-Pierre Michel Bernard Yannick Karim Mehdi Amine Youssef`,
    `Jade Louise Emma Alice Ambre Lina Rose Chloé Mia Léa Anna Inès Camille Manon Sarah Juliette Zoé Lucie Jeanne Margaux Océane Clara Éloïse Apolline Constance Charlotte Agathe Mathilde Capucine Sophie Isabelle Nathalie Sylvie Brigitte Valérie Céline Aurélie Élodie Fatima Yasmine Nour Salomé`,
    `Martin Bernard Thomas Petit Robert Richard Durand Dubois Moreau Laurent Simon Michel Lefebvre Leroy Roux David Bertrand Morel Fournier Girard Bonnet Dupont Lambert Fontaine Rousseau Vincent Muller Lefèvre Faure André Mercier Blanc Guérin Boyer Garnier Chevalier François Legrand Gauthier Garcia Perrin Robin Clément Morin Nicolas Henry Roussel Mathieu Gautier Masson Marchand Duval Denis Dumont Marie Lemaire Noël Meyer Dufour Meunier Brun Blanchard Giraud Joly Rivière Lucas Brunet Gaillard Barbier Arnaud Martinez Gérard Roche Renard Schmitt Roy Leroux Colin Vidal Caron Picard Roger Fabre Aubert Lemoine Renaud Dumas Lacroix Olivier Philippe Bourgeois Pierre Benoît Rey Leclerc Payet Rolland Leclercq Guillaume Lecomte López Jean Dupuy Guillot Hubert Berger Carpentier Sanchez Dupuis Moulin Louis Deschamps Huet Vasseur Perez Boucher Fleury Royer Klein Jacquet Adam Paris Poirier Marty Aubry Guyot Carré Charles Renault Charpentier Ménard Maillard Baron Bertin Bailly Hervé Schneider Fernandez Le_Gall Collet Léger Bouvier Julien Prévost Millet Perrot Daniel Le_Roux Cousin Germain Breton Besson Langlois Rémy Le_Goff Pelletier Lévêque Perrier Leblanc Barré Lebrun Marchal Weber Mallet Hamon Boulanger Jacob Monnier Michaud Rodriguez Guichard Gillet Étienne Grondin Poulain Tessier Chevallier Collin Chauvin da_Silva Bouchet Gay Lemaître Bénard Marechal Humbert Reynaud Antoine Hoarau Perret Barre Cordier Pichon Lejeune Gilbert Lamy Delaunay Pasquier Carlier Laporte`,
  ),
  Japan: pool(
    `Haruto Ren Sota Yuto Hinata Riku Minato Kaito Yuma Takumi Daiki Kenta Shota Ryota Hayato Naoki Satoshi Takeshi Hiroshi Kenji Akira Makoto Daisuke Taro Jiro Kazuki Tomoya Yusuke Masato Shun Kei Ryo Itsuki Sosuke Tatsuya Koji Hideo Isamu Noboru Osamu Tetsuya Yoshio Masaru Katsuo`,
    `Himari Hina Yua Sakura Mio Rin Aoi Yui Mei Honoka Koharu Hana Yuna Nanami Haruka Ayaka Misaki Saki Mai Yuki Emi Kaori Akane Aya Chihiro Miyu Natsuki Risa Rika Shiori Tomoko Yoko Keiko Kazuko Sachiko Michiko Noriko Fumiko Hiroko Setsuko Mariko Reiko Asuka Kanna Suzu`,
    `Sato Suzuki Takahashi Tanaka Watanabe Ito Yamamoto Nakamura Kobayashi Kato Yoshida Yamada Sasaki Yamaguchi Matsumoto Inoue Kimura Hayashi Shimizu Yamazaki Mori Abe Ikeda Hashimoto Ishikawa Ogawa Goto Okada Hasegawa Murakami Kondo Ishii Saito Sakamoto Endo Aoki Fujii Nishimura Fukuda Ota Miura Okamoto Matsuda Nakagawa Nakano Harada Ono Tamura Takeuchi Kaneko Wada Nakayama Ishida Ueda Morita Hara Shibata Sakai Kudo Yokoyama Miyazaki Miyamoto Uchida Takagi Ando Taniguchi Ohno Maruyama Imai Takada Fujita Matsui`,
  ),
  India: pool(
    `Aarav Vivaan Aditya Vihaan Arjun Sai Reyansh Ayaan Krishna Ishaan Rohan Rahul Amit Vikram Sanjay Rajesh Suresh Ramesh Anil Manoj Deepak Pranav Karan Nikhil Siddharth Varun Kabir Dev Yash Harsh Mohammed Imran Faisal Gurpreet Harjit Jaspreet Arvind Kiran Ganesh Venkat Srinivas Prakash Mahesh Naveen Tarun Aman Ankit Abhishek`,
    `Aadhya Ananya Diya Saanvi Anika Myra Pari Ira Kavya Priya Pooja Neha Sneha Anjali Divya Meera Riya Shreya Aisha Fatima Zoya Simran Harleen Gurleen Lakshmi Sita Radha Sunita Kavita Rekha Sushma Geeta Anita Nisha Isha Tanvi Pallavi Swati Deepika Shruti Ritu Mansi Aarti Bhavna Jyoti Padma Uma`,
    `Sharma Verma Gupta Singh Kumar Patel Shah Mehta Joshi Reddy Rao Nair Iyer Iyengar Menon Pillai Das Bose Chatterjee Banerjee Mukherjee Ghosh Sen Roy Dutta Khan Ahmed Ali Hussain Qureshi Siddiqui Ansari Malik Chopra Kapoor Malhotra Khanna Bhatia Arora Sethi Grewal Gill Sandhu Dhillon Sidhu Brar Kaur Desai Kulkarni Deshmukh Patil Jadhav Pawar Shinde Naidu Chowdhury Agarwal Jain Mishra Pandey Tiwari Yadav Thakur Saxena Bhatt Kohli`,
  ),
  Brazil: pool(
    `Miguel Arthur Heitor Theo Davi Gabriel Bernardo Samuel João Pedro Lucas Matheus Guilherme Rafael Gustavo Felipe Bruno Thiago Diego Rodrigo Leonardo Eduardo Fernando Marcelo Ricardo Carlos Paulo José Antônio Francisco Luiz Jorge Sérgio Marcos Fábio Renato Caio Vinícius Enzo Lorenzo Henrique Murilo Otávio Ronaldo Neymar`,
    `Helena Alice Laura Maria Valentina Heloísa Sophia Isabella Manuela Luiza Júlia Lívia Beatriz Cecília Eloá Lara Mariana Camila Gabriela Larissa Fernanda Juliana Amanda Letícia Bruna Carolina Patrícia Aline Renata Vanessa Priscila Raquel Daniela Rafaela Clara Giovanna Yasmin Isadora Nicole Ana Luana Thaís`,
    `Silva Santos Oliveira Souza Rodrigues Ferreira Alves Pereira Lima Gomes Costa Ribeiro Martins Carvalho Almeida Lopes Soares Fernandes Vieira Barbosa Rocha Dias Nascimento Andrade Moreira Nunes Marques Machado Mendes Freitas Cardoso Ramos Gonçalves Santana Teixeira Araújo Cavalcanti Azevedo Correia Pinto Moura Monteiro Barros Medeiros Campos Cunha Borges Duarte Castro Bezerra Tavares Peixoto Rezende Siqueira Fonseca Miranda Batista Mello Xavier Franco Guimarães Brandão Tanaka Yamamoto Schmidt Müller Rossi Ferrari Bianchi`,
  ),
  Mexico: pool(
    `Santiago Mateo Sebastián Matías Emiliano Diego Leonardo Miguel Daniel Alexander Carlos José Luis Juan Jorge Pedro Francisco Antonio Manuel Javier Fernando Ricardo Alejandro Eduardo Roberto Raúl Rafael Héctor Arturo Gerardo Salvador Ángel Iván Óscar Rodrigo Andrés Cristian Emilio Adrián Gael Bruno Joaquín Ramón Ignacio Octavio Rogelio`,
    `Sofía Valentina Regina Camila Ximena Maria Fernanda Victoria Renata Mariana Isabella Natalia Daniela Gabriela Andrea Paola Valeria Guadalupe Rosa Carmen Lupita Dolores Mercedes Esperanza Alejandra Sandra Patricia Leticia Verónica Claudia Adriana Karla Yolanda Elena Lucía Montserrat Itzel Xochitl Citlali Marisol Abril Frida`,
    `Hernández García Martínez López González Rodríguez Pérez Sánchez Ramírez Flores Gómez Díaz Reyes Cruz Morales Ortiz Gutiérrez Chávez Ramos Ruiz Mendoza Aguilar Castillo Vázquez Jiménez Moreno Romero Herrera Medina Torres Domínguez Vargas Castro Guerrero Rojas Salazar Ríos Núñez Soto Contreras Silva Delgado Pacheco Cabrera Ibarra Maldonado Santos Rivera Fuentes Navarro Campos Estrada Valdez Cervantes Luna Ponce Ochoa Beltrán Cortés Padilla Zamora Acosta Montes Solís Villanueva`,
  ),
  Spain: pool(
    `Hugo Martín Lucas Mateo Leo Daniel Alejandro Pablo Manuel Álvaro Adrián Enzo David Javier Diego Marcos Carlos Jorge Sergio Iván Rubén Raúl Fernando Antonio José Francisco Juan Miguel Ángel Rafael Pedro Luis Alberto Andrés Ignacio Joaquín Jaime Gonzalo Víctor Borja Xavier Jordi Iker Unai Aitor Mikel Ander Kike`,
    `Lucía Sofía Martina María Julia Paula Valeria Emma Daniela Carla Sara Alba Noa Claudia Ana Elena Laura Marta Carmen Pilar Isabel Dolores Teresa Rosario Cristina Beatriz Raquel Irene Silvia Natalia Patricia Rocío Inés Nuria Montserrat Mercè Aitana Amaia Maite Itziar Naiara Leire Estrella Macarena`,
    `García Rodríguez González Fernández López Martínez Sánchez Pérez Gómez Martín Jiménez Ruiz Hernández Díaz Moreno Muñoz Álvarez Romero Alonso Gutiérrez Navarro Torres Domínguez Vázquez Ramos Gil Ramírez Serrano Blanco Molina Morales Suárez Ortega Delgado Castro Ortiz Rubio Marín Sanz Núñez Iglesias Medina Garrido Cortés Castillo Santos Lozano Guerrero Cano Prieto Méndez Cruz Calvo Gallego Vidal León Márquez Herrera Peña Flores Cabrera Campos Vega Fuentes Carrasco Diez Caballero Reyes Nieto Aguilar Pascual Santana Herrero Lorenzo Hidalgo Giménez Ibáñez Ferrer Durán Santiago Benítez Mora Vicente Vargas Arias Carmona Crespo Román Pastor Soto Sáez Velasco Moya Soler Parra Esteban Bravo Gallardo Rojas Etxeberria Goikoetxea Puigdemont Ferrer`,
  ),
  Sweden: pool(
    `Lucas Liam William Oscar Elias Hugo Noah Oliver Adam Axel Alexander Filip Leo Viktor Isak Emil Theo Vincent Ludvig Melvin Gustav Anton Erik Karl Nils Lars Anders Johan Per Mikael Jonas Henrik Magnus Sven Olof Bengt Stefan Mats Fredrik Daniel Jesper Simon Rasmus Tobias Olle Alvar Sixten Folke`,
    `Alice Maja Elsa Astrid Ella Olivia Wilma Alma Ebba Vera Molly Freja Lilly Saga Selma Ellen Julia Ida Klara Linnea Emma Amanda Elin Sofia Hanna Karin Anna Maria Eva Birgitta Kristina Lena Ingrid Margareta Marie Gunilla Helena Cecilia Sara Johanna Matilda Stina Greta Tuva Agnes`,
    `Andersson Johansson Karlsson Nilsson Eriksson Larsson Olsson Persson Svensson Gustafsson Pettersson Jonsson Jansson Hansson Bengtsson Jönsson Lindberg Jakobsson Magnusson Olofsson Lindström Lindqvist Lindgren Axelsson Berg Bergström Lundberg Lundgren Lind Lundqvist Mattsson Berglund Fredriksson Sandberg Henriksson Forsberg Sjöberg Wallin Engström Eklund Danielsson Håkansson Lundin Björk Holm Nyström Isaksson Samuelsson Wikström Nordin Strand Holmberg Åberg Sjögren Ekström Hedlund Dahl Falk Blomqvist Ström Mårtensson Åkesson Nyberg Norberg Hellström Abdi Hussein`,
  ),
  Netherlands: pool(
    `Noah Sem Liam Lucas Daan Finn Levi Luuk Bram Milan Adam Jesse Thomas Mees Max Sam Jayden Julian Gijs Ruben Thijs Jasper Sander Tim Rick Jeroen Bas Joost Wouter Pieter Hendrik Willem Jan Kees Cornelis Johannes Dirk Maarten Stijn Niels Koen Floris Thijmen Teun Dylan Mohamed Yusuf`,
    `Emma Julia Mila Tess Sophie Zoë Sara Noor Anna Eva Lotte Liv Saar Fleur Isa Lieke Fenna Evi Nina Roos Anouk Femke Marloes Esmée Maud Sanne Iris Lisa Marieke Johanna Cornelia Geertruida Hendrika Wilhelmina Annemiek Ingrid Karin Yvonne Sylvia Merel Floor Famke Bo Yasmina Fatima`,
    `de_Jong Jansen de_Vries van_den_Berg van_Dijk Bakker Janssen Visser Smit Meijer de_Boer Mulder de_Groot Bos Vos Peters Hendriks van_Leeuwen Dekker Brouwer de_Wit Dijkstra Smits de_Graaf van_der_Meer van_der_Linden Kok Jacobs de_Haan Vermeulen van_den_Heuvel van_der_Veen van_den_Broek de_Bruijn de_Bruin van_der_Heijden Schouten van_Beek Willems van_Vliet van_de_Ven Hoekstra Maas Verhoeven Koster Prins Huisman Peeters Kuipers van_Dam Kramer Bosman Postma Scholten Hoogland Bouwman Aydin Yilmaz El_Amrani Bakkali`,
  ),
  Nigeria: pool(
    `Chinedu Emeka Obinna Ifeanyi Chukwuemeka Nnamdi Ikenna Kelechi Uchenna Tobechukwu Oluwaseun Oluwatobi Adebayo Babatunde Olumide Tunde Femi Segun Kunle Dayo Kayode Damilola Ayodele Oluwafemi Ibrahim Musa Abubakar Usman Aliyu Sani Yusuf Mohammed Bashir Garba Abdullahi Ahmed Emmanuel Chukwudi Ebuka Somto Nonso Tochukwu Efe Osas Eze Tamuno Ebikibina Ndubuisi`,
    `Chiamaka Adaeze Ngozi Chioma Ifunanya Nkechi Obiageli Uchechi Amaka Ebele Folasade Funmilayo Oluwakemi Titilayo Yetunde Bukola Temitope Damilola Adebisi Abosede Aisha Fatima Hauwa Zainab Khadija Maryam Amina Halima Hadiza Rashida Blessing Gift Grace Precious Favour Mercy Joy Patience Faith Ifeoma Uzoamaka Nneka Chidinma Ogechi Omolara Bisi Tolu Efe Ibiene Ene`,
    `Okafor Okeke Nwosu Eze Okoro Obi Nnamdi Chukwu Adeyemi Adeleke Ogunbanjo Okonkwo Ibrahim Abubakar Bello Musa Lawal Balogun Adebayo Ogunleye Olawale Afolabi Ajayi Akinwumi Babatunde Fashola Ogunlana Oyelaran Salami Suleiman Umar Danjuma Mohammed Garba Usman Yakubu Okpara Nwachukwu Onyeama Emenike Uche Igwe Anyanwu Ugwu Eboh Amadi Dike Opara Ekwueme Olatunji Akinola Adesanya Williams Johnson Edet Bassey Etim Effiong`,
  ),
  "South Korea": pool(
    `Minjun Seojun Doyun Haneul Siwoo Yejun Junseo Jiho Hyunwoo Joonho Minho Jinwoo Seungmin Taehyun Sungmin Jaehyun Dongwoo Hyunjin Woojin Jisung Youngho Sangwoo Kyungsoo Jungkook Donghyun Seokjin Namjoon Yoongi Taeyang Jaewon Hoseok Eunwoo Gunwoo Junyoung Chanyeol Sehun Kai Minseok Joowon Sunghoon Jaemin`,
    `Seoyeon Haeun Jiwoo Seoa Haseo Jia Ayoon Yuna Subin Minseo Chaewon Sooah Hyejin Eunji Jiyeon Soyeon Nayeon Jisoo Rosé Jennie Minji Hanni Danielle Hyein Yerin Sowon Eunha Yuju Chaeyoung Dahyun Tzuyu Jihyo Somi Yoonah Sumin Bora Mina Soojin Hyunji Eunseo Dayeon Gaeun Nari`,
    `Kim Lee Park Choi Jung Kang Cho Yoon Jang Lim Han Oh Seo Shin Kwon Hwang Ahn Song Yoo Hong Jeon Go Moon Yang Son Bae Baek Heo Nam Shim Noh Ha Kwak Sung Cha Joo Woo Min Ryu Na Jin Ji Eom Chae Won Cheon Bang Gong Hyun Ham Byun`,
  ),
  Italy: pool(
    `Leonardo Francesco Alessandro Lorenzo Mattia Andrea Gabriele Riccardo Tommaso Edoardo Matteo Giuseppe Antonio Giovanni Luca Marco Davide Simone Federico Stefano Paolo Roberto Alberto Fabio Claudio Massimo Gianluca Salvatore Vincenzo Pasquale Rocco Carmine Enzo Nicola Emanuele Michele Daniele Samuele Christian Filippo Giacomo Raffaele Domenico Sergio Franco Aldo Mario`,
    `Sofia Aurora Giulia Ginevra Alice Beatrice Emma Giorgia Greta Martina Vittoria Chiara Francesca Sara Alessia Elisa Anna Maria Lucia Rosa Carmela Concetta Angela Giovanna Antonella Paola Silvia Roberta Valentina Federica Elena Ilaria Serena Laura Monica Raffaella Daniela Michela Noemi Camilla Bianca Arianna Cristina Teresa Gianna Nunzia`,
    `Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti De_Luca Mancini Costa Giordano Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferrara Galli Martini Leone Longo Gentile Martinelli Vitale Lombardo Serra Coppola De_Santis D'Angelo Marchetti Parisi Villa Conte Ferraro Ferri Fabbri Bianco Marini Grasso Valentini Messina Sala De_Angelis Gatti Pellegrini Palumbo Sanna Farina Rizzi Monti Cattaneo Morelli Amato Silvestri Mazza Testa Grassi Pellegrino Carbone Giuliani Benedetti Barone Rossetti Caputo Montanari Guerra Palmieri Bernardi Martino Fiore De_Rosa Ferretti Bellini Basile Riva Donati Piras Vitali Battaglia Sartori Neri Costantini Milani Pagano Ruggiero Sorrentino D'Amico Orlando Negri`,
  ),
};

/** Fallback so a missing country never crashes name generation. */
export const DEFAULT_POOL: NamePool = NAME_POOLS["United States"];

/** Surnames of recent-immigrant families, mixed into the multicultural countries' pools. */
const DIASPORA_LAST = words(
  `Patel Singh Khan Ahmed Hussain Ali Chen Wang Li Zhang Nguyen Tran Kim Park Cohen Levy Kowalski Nowak Popescu Ivanov Okafor Adeyemi Mensah Osei Hassan Mohamed Ibrahim Silva Santos Garcia Rodriguez Papadopoulos Rossi Costa Jovanovic Petrov`,
);
const DIASPORA_SHARE: Record<string, number> = {
  "United States": 0.14,
  "United Kingdom": 0.14,
  Canada: 0.18,
  Australia: 0.16,
  Germany: 0.1,
  France: 0.1,
  Netherlands: 0.1,
  Sweden: 0.1,
};

/** Older generations' first names in the English-speaking countries (the pools are modern). */
const CLASSIC_FIRST: Record<string, { male: string[]; female: string[] }> = {
  default: {
    male: words(`John William James George Charles Robert Thomas Arthur Frank Harold Walter Albert Edward Raymond Donald Kenneth Eugene Ralph Howard Herbert Roy Leonard Norman Stanley Gerald`),
    female: words(`Mary Margaret Dorothy Helen Betty Ruth Doris Edna Florence Gladys Irene Joan Marjorie Phyllis Shirley Eleanor Barbara Joyce Beryl Maureen Edith Hilda Vera Sylvia`),
  },
};
const CLASSIC_COUNTRIES = new Set(["United States", "United Kingdom", "Canada", "Australia"]);

export function lastNameFor(countryName: string, rng: { next(): number; pick<T>(items: readonly T[]): T }): string {
  const p = NAME_POOLS[countryName] ?? DEFAULT_POOL;
  const share = DIASPORA_SHARE[countryName] ?? 0;
  if (share > 0 && rng.next() < share) return rng.pick(DIASPORA_LAST);
  return rng.pick(p.last);
}

/** A first name for someone born long ago (grandparents). */
export function classicFirstName(countryName: string, gender: string, rng: { next(): number; pick<T>(items: readonly T[]): T }): string | null {
  if (!CLASSIC_COUNTRIES.has(countryName)) return null;
  const c = CLASSIC_FIRST.default;
  return rng.pick(gender === "Male" ? c.male : gender === "Female" ? c.female : [...c.male, ...c.female]);
}
