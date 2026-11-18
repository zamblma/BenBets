import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, BookOpen, Star, Medal } from 'lucide-react';
import type { PokemonCard } from '../types';
import { fetchWikiThumbnails } from '../utils/wikiImages';
import { useSound } from '../hooks/useSound';

interface Player {
  id: string;
  name: string;
  position: string;
  teamId: string;
  teamName: string;
  iso: string;
  rarity: string;
  wikiTitle?: string;
}

const PACK_PRICE = 10;

const TEAMS: { id: string; name: string; iso: string; group: string }[] = [
  { id: 'mex', name: 'México', iso: 'mx', group: 'A' },
  { id: 'rsa', name: 'África do Sul', iso: 'za', group: 'A' },
  { id: 'kor', name: 'Coreia do Sul', iso: 'kr', group: 'A' },
  { id: 'cze', name: 'Tchéquia', iso: 'cz', group: 'A' },
  { id: 'can', name: 'Canadá', iso: 'ca', group: 'B' },
  { id: 'bih', name: 'Bósnia e Herzegovina', iso: 'ba', group: 'B' },
  { id: 'qat', name: 'Catar', iso: 'qa', group: 'B' },
  { id: 'sui', name: 'Suíça', iso: 'ch', group: 'B' },
  { id: 'bra', name: 'Brasil', iso: 'br', group: 'C' },
  { id: 'mar', name: 'Marrocos', iso: 'ma', group: 'C' },
  { id: 'hai', name: 'Haiti', iso: 'ht', group: 'C' },
  { id: 'sco', name: 'Escócia', iso: 'gb-sct', group: 'C' },
  { id: 'usa', name: 'Estados Unidos', iso: 'us', group: 'D' },
  { id: 'par', name: 'Paraguai', iso: 'py', group: 'D' },
  { id: 'aus', name: 'Austrália', iso: 'au', group: 'D' },
  { id: 'tur', name: 'Turquia', iso: 'tr', group: 'D' },
  { id: 'ger', name: 'Alemanha', iso: 'de', group: 'E' },
  { id: 'cuc', name: 'Curaçao', iso: 'cw', group: 'E' },
  { id: 'civ', name: 'Costa do Marfim', iso: 'ci', group: 'E' },
  { id: 'ecu', name: 'Equador', iso: 'ec', group: 'E' },
  { id: 'ned', name: 'Países Baixos', iso: 'nl', group: 'F' },
  { id: 'jpn', name: 'Japão', iso: 'jp', group: 'F' },
  { id: 'swe', name: 'Suécia', iso: 'se', group: 'F' },
  { id: 'tun', name: 'Tunísia', iso: 'tn', group: 'F' },
  { id: 'bel', name: 'Bélgica', iso: 'be', group: 'G' },
  { id: 'egy', name: 'Egito', iso: 'eg', group: 'G' },
  { id: 'irn', name: 'Irã', iso: 'ir', group: 'G' },
  { id: 'nzl', name: 'Nova Zelândia', iso: 'nz', group: 'G' },
  { id: 'esp', name: 'Espanha', iso: 'es', group: 'H' },
  { id: 'cpv', name: 'Cabo Verde', iso: 'cv', group: 'H' },
  { id: 'ksa', name: 'Arábia Saudita', iso: 'sa', group: 'H' },
  { id: 'uru', name: 'Uruguai', iso: 'uy', group: 'H' },
  { id: 'fra', name: 'França', iso: 'fr', group: 'I' },
  { id: 'sen', name: 'Senegal', iso: 'sn', group: 'I' },
  { id: 'irq', name: 'Iraque', iso: 'iq', group: 'I' },
  { id: 'nor', name: 'Noruega', iso: 'no', group: 'I' },
  { id: 'arg', name: 'Argentina', iso: 'ar', group: 'J' },
  { id: 'alg', name: 'Argélia', iso: 'dz', group: 'J' },
  { id: 'aut', name: 'Áustria', iso: 'at', group: 'J' },
  { id: 'jor', name: 'Jordânia', iso: 'jo', group: 'J' },
  { id: 'por', name: 'Portugal', iso: 'pt', group: 'K' },
  { id: 'cod', name: 'RD Congo', iso: 'cd', group: 'K' },
  { id: 'uzb', name: 'Uzbequistão', iso: 'uz', group: 'K' },
  { id: 'col', name: 'Colômbia', iso: 'co', group: 'K' },
  { id: 'eng', name: 'Inglaterra', iso: 'gb-eng', group: 'L' },
  { id: 'cro', name: 'Croácia', iso: 'hr', group: 'L' },
  { id: 'gha', name: 'Gana', iso: 'gh', group: 'L' },
  { id: 'pan', name: 'Panamá', iso: 'pa', group: 'L' },
];

// Real national team stars with Wikipedia page titles for reliable portrait photos
const REAL_ROSTERS: Record<string, { name: string; pos: string; wiki: string }[]> = {
  bra: [
    { name: 'Vinícius Júnior', pos: 'AT', wiki: 'Vinícius_Júnior' },
    { name: 'Rodrygo', pos: 'AT', wiki: 'Rodrygo' },
    { name: 'Alisson Becker', pos: 'GOL', wiki: 'Alisson_Becker' },
    { name: 'Raphinha', pos: 'AT', wiki: 'Raphinha' },
    { name: 'Bruno Guimarães', pos: 'VOL', wiki: 'Bruno_Guimarães' },
    { name: 'Marquinhos', pos: 'ZAG', wiki: 'Marquinhos' },
    { name: 'Gabriel Magalhães', pos: 'ZAG', wiki: 'Gabriel_Magalhães' },
    { name: 'Lucas Paquetá', pos: 'MEI', wiki: 'Lucas_Paquetá' },
    { name: 'Endrick', pos: 'AT', wiki: 'Endrick' },
    { name: 'Estêvão', pos: 'AT', wiki: 'Estêvão_Willian' },
    { name: 'Danilo', pos: 'LD', wiki: 'Danilo_(footballer,_born_July_1991)' },
    { name: 'Ederson', pos: 'GOL', wiki: 'Ederson_(footballer,_born_1993)' },
  ],
  arg: [
    { name: 'Lionel Messi', pos: 'AT', wiki: 'Lionel_Messi' },
    { name: 'Lautaro Martínez', pos: 'AT', wiki: 'Lautaro_Martínez' },
    { name: 'Emiliano Martínez', pos: 'GOL', wiki: 'Emiliano_Martínez' },
    { name: 'Julián Álvarez', pos: 'AT', wiki: 'Julián_Álvarez' },
    { name: 'Enzo Fernández', pos: 'VOL', wiki: 'Enzo_Fernández' },
    { name: 'Alexis Mac Allister', pos: 'MEI', wiki: 'Alexis_Mac_Allister' },
    { name: 'Rodrigo De Paul', pos: 'MEI', wiki: 'Rodrigo_De_Paul' },
    { name: 'Cristian Romero', pos: 'ZAG', wiki: 'Cristian_Romero' },
    { name: 'Lisandro Martínez', pos: 'ZAG', wiki: 'Lisandro_Martínez' },
    { name: 'Nahuel Molina', pos: 'LD', wiki: 'Nahuel_Molina' },
    { name: 'Nicolás Tagliafico', pos: 'LE', wiki: 'Nicolás_Tagliafico' },
    { name: 'Alejandro Garnacho', pos: 'AT', wiki: 'Alejandro_Garnacho' },
  ],
  fra: [
    { name: 'Kylian Mbappé', pos: 'AT', wiki: 'Kylian_Mbappé' },
    { name: 'Antoine Griezmann', pos: 'MEI', wiki: 'Antoine_Griezmann' },
    { name: 'Ousmane Dembélé', pos: 'AT', wiki: 'Ousmane_Dembélé' },
    { name: 'Mike Maignan', pos: 'GOL', wiki: 'Mike_Maignan' },
    { name: 'Aurélien Tchouaméni', pos: 'VOL', wiki: 'Aurélien_Tchouaméni' },
    { name: 'Eduardo Camavinga', pos: 'VOL', wiki: 'Eduardo_Camavinga' },
    { name: 'William Saliba', pos: 'ZAG', wiki: 'William_Saliba' },
    { name: 'Theo Hernández', pos: 'LE', wiki: 'Theo_Hernández' },
    { name: 'Jules Koundé', pos: 'LD', wiki: 'Jules_Koundé' },
    { name: 'Marcus Thuram', pos: 'AT', wiki: 'Marcus_Thuram' },
    { name: 'Bradley Barcola', pos: 'AT', wiki: 'Bradley_Barcola' },
    { name: 'Ibrahima Konaté', pos: 'ZAG', wiki: 'Ibrahima_Konaté' },
  ],
  eng: [
    { name: 'Jude Bellingham', pos: 'MEI', wiki: 'Jude_Bellingham' },
    { name: 'Harry Kane', pos: 'AT', wiki: 'Harry_Kane' },
    { name: 'Bukayo Saka', pos: 'AT', wiki: 'Bukayo_Saka' },
    { name: 'Phil Foden', pos: 'MEI', wiki: 'Phil_Foden' },
    { name: 'Declan Rice', pos: 'VOL', wiki: 'Declan_Rice' },
    { name: 'Cole Palmer', pos: 'MEI', wiki: 'Cole_Palmer' },
    { name: 'Jordan Pickford', pos: 'GOL', wiki: 'Jordan_Pickford' },
    { name: 'John Stones', pos: 'ZAG', wiki: 'John_Stones' },
    { name: 'Trent Alexander-Arnold', pos: 'LD', wiki: 'Trent_Alexander-Arnold' },
    { name: 'Ollie Watkins', pos: 'AT', wiki: 'Ollie_Watkins' },
    { name: 'Marc Guéhi', pos: 'ZAG', wiki: 'Marc_Guéhi' },
    { name: 'Kobbie Mainoo', pos: 'VOL', wiki: 'Kobbie_Mainoo' },
  ],
  por: [
    { name: 'Cristiano Ronaldo', pos: 'AT', wiki: 'Cristiano_Ronaldo' },
    { name: 'Bruno Fernandes', pos: 'MEI', wiki: 'Bruno_Fernandes' },
    { name: 'Bernardo Silva', pos: 'MEI', wiki: 'Bernardo_Silva' },
    { name: 'Rafael Leão', pos: 'AT', wiki: 'Rafael_Leão' },
    { name: 'Rúben Dias', pos: 'ZAG', wiki: 'Rúben_Dias' },
    { name: 'Vitinha', pos: 'VOL', wiki: 'Vitinha_(footballer,_born_February_2000)' },
    { name: 'Diogo Costa', pos: 'GOL', wiki: 'Diogo_Costa_(footballer)' },
    { name: 'João Neves', pos: 'VOL', wiki: 'João_Neves' },
    { name: 'Nuno Mendes', pos: 'LE', wiki: 'Nuno_Mendes_(footballer,_born_2002)' },
    { name: 'Diogo Jota', pos: 'AT', wiki: 'Diogo_Jota' },
  ],
  esp: [
    { name: 'Lamine Yamal', pos: 'AT', wiki: 'Lamine_Yamal' },
    { name: 'Rodri', pos: 'VOL', wiki: 'Rodri_(footballer,_born_1996)' },
    { name: 'Pedri', pos: 'MEI', wiki: 'Pedri' },
    { name: 'Nico Williams', pos: 'AT', wiki: 'Nico_Williams' },
    { name: 'Dani Olmo', pos: 'MEI', wiki: 'Dani_Olmo' },
    { name: 'Unai Simón', pos: 'GOL', wiki: 'Unai_Simón' },
    { name: 'Dani Carvajal', pos: 'LD', wiki: 'Dani_Carvajal' },
    { name: 'Álvaro Morata', pos: 'AT', wiki: 'Álvaro_Morata' },
    { name: 'Gavi', pos: 'MEI', wiki: 'Gavi_(footballer)' },
    { name: 'Pau Cubarsí', pos: 'ZAG', wiki: 'Pau_Cubarsí' },
  ],
  ger: [
    { name: 'Jamal Musiala', pos: 'MEI', wiki: 'Jamal_Musiala' },
    { name: 'Florian Wirtz', pos: 'MEI', wiki: 'Florian_Wirtz' },
    { name: 'Kai Havertz', pos: 'AT', wiki: 'Kai_Havertz' },
    { name: 'Joshua Kimmich', pos: 'VOL', wiki: 'Joshua_Kimmich' },
    { name: 'Antonio Rüdiger', pos: 'ZAG', wiki: 'Antonio_Rüdiger' },
    { name: 'Marc-André ter Stegen', pos: 'GOL', wiki: 'Marc-André_ter_Stegen' },
    { name: 'Niclas Füllkrug', pos: 'AT', wiki: 'Niclas_Füllkrug' },
    { name: 'Jonathan Tah', pos: 'ZAG', wiki: 'Jonathan_Tah' },
  ],
  ned: [
    { name: 'Virgil van Dijk', pos: 'ZAG', wiki: 'Virgil_van_Dijk' },
    { name: 'Frenkie de Jong', pos: 'VOL', wiki: 'Frenkie_de_Jong' },
    { name: 'Cody Gakpo', pos: 'AT', wiki: 'Cody_Gakpo' },
    { name: 'Xavi Simons', pos: 'MEI', wiki: 'Xavi_Simons' },
    { name: 'Memphis Depay', pos: 'AT', wiki: 'Memphis_Depay' },
    { name: 'Denzel Dumfries', pos: 'LD', wiki: 'Denzel_Dumfries' },
  ],
  bel: [
    { name: 'Kevin De Bruyne', pos: 'MEI', wiki: 'Kevin_De_Bruyne' },
    { name: 'Romelu Lukaku', pos: 'AT', wiki: 'Romelu_Lukaku' },
    { name: 'Jérémy Doku', pos: 'AT', wiki: 'Jérémy_Doku' },
    { name: 'Thibaut Courtois', pos: 'GOL', wiki: 'Thibaut_Courtois' },
    { name: 'Amadou Onana', pos: 'VOL', wiki: 'Amadou_Onana' },
  ],
  uru: [
    { name: 'Federico Valverde', pos: 'MEI', wiki: 'Federico_Valverde' },
    { name: 'Darwin Núñez', pos: 'AT', wiki: 'Darwin_Núñez' },
    { name: 'Ronald Araújo', pos: 'ZAG', wiki: 'Ronald_Araújo' },
    { name: 'Manuel Ugarte', pos: 'VOL', wiki: 'Manuel_Ugarte' },
  ],
  col: [
    { name: 'Luis Díaz', pos: 'AT', wiki: 'Luis_Díaz_(Colombian_footballer)' },
    { name: 'James Rodríguez', pos: 'MEI', wiki: 'James_Rodríguez' },
    { name: 'Jhon Durán', pos: 'AT', wiki: 'Jhon_Durán' },
    { name: 'Daniel Muñoz', pos: 'LD', wiki: 'Daniel_Muñoz_(footballer)' },
  ],
  cro: [
    { name: 'Luka Modrić', pos: 'MEI', wiki: 'Luka_Modrić' },
    { name: 'Joško Gvardiol', pos: 'ZAG', wiki: 'Joško_Gvardiol' },
    { name: 'Mateo Kovačić', pos: 'VOL', wiki: 'Mateo_Kovačić' },
    { name: 'Dominik Livaković', pos: 'GOL', wiki: 'Dominik_Livaković' },
  ],
  mar: [
    { name: 'Achraf Hakimi', pos: 'LD', wiki: 'Achraf_Hakimi' },
    { name: 'Brahim Díaz', pos: 'MEI', wiki: 'Brahim_Díaz' },
    { name: 'Yassine Bounou', pos: 'GOL', wiki: 'Yassine_Bounou' },
    { name: 'Sofyan Amrabat', pos: 'VOL', wiki: 'Sofyan_Amrabat' },
  ],
  jpn: [
    { name: 'Takefusa Kubo', pos: 'MEI', wiki: 'Takefusa_Kubo' },
    { name: 'Kaoru Mitoma', pos: 'AT', wiki: 'Kaoru_Mitoma' },
    { name: 'Wataru Endo', pos: 'VOL', wiki: 'Wataru_Endo' },
    { name: 'Takehiro Tomiyasu', pos: 'ZAG', wiki: 'Takehiro_Tomiyasu' },
  ],
  kor: [
    { name: 'Son Heung-min', pos: 'AT', wiki: 'Son_Heung-min' },
    { name: 'Kim Min-jae', pos: 'ZAG', wiki: 'Kim_Min-jae_(footballer)' },
    { name: 'Lee Kang-in', pos: 'MEI', wiki: 'Lee_Kang-in' },
    { name: 'Hwang Hee-chan', pos: 'AT', wiki: 'Hwang_Hee-chan' },
  ],
  usa: [
    { name: 'Christian Pulisic', pos: 'AT', wiki: 'Christian_Pulisic' },
    { name: 'Weston McKennie', pos: 'MEI', wiki: 'Weston_McKennie' },
    { name: 'Tyler Adams', pos: 'VOL', wiki: 'Tyler_Adams' },
    { name: 'Antonee Robinson', pos: 'LE', wiki: 'Antonee_Robinson' },
  ],
  can: [
    { name: 'Alphonso Davies', pos: 'LE', wiki: 'Alphonso_Davies' },
    { name: 'Jonathan David', pos: 'AT', wiki: 'Jonathan_David' },
    { name: 'Stephen Eustáquio', pos: 'VOL', wiki: 'Stephen_Eustáquio' },
  ],
  mex: [
    { name: 'Santiago Giménez', pos: 'AT', wiki: 'Santiago_Giménez' },
    { name: 'Edson Álvarez', pos: 'VOL', wiki: 'Edson_Álvarez' },
    { name: 'Guillermo Ochoa', pos: 'GOL', wiki: 'Guillermo_Ochoa' },
    { name: 'Hirving Lozano', pos: 'AT', wiki: 'Hirving_Lozano' },
  ],
  nor: [
    { name: 'Erling Haaland', pos: 'AT', wiki: 'Erling_Haaland' },
    { name: 'Martin Ødegaard', pos: 'MEI', wiki: 'Martin_Ødegaard' },
    { name: 'Alexander Sørloth', pos: 'AT', wiki: 'Alexander_Sørloth' },
  ],
  egy: [
    { name: 'Mohamed Salah', pos: 'AT', wiki: 'Mohamed_Salah' },
    { name: 'Omar Marmoush', pos: 'AT', wiki: 'Omar_Marmoush' },
  ],
  sen: [
    { name: 'Sadio Mané', pos: 'AT', wiki: 'Sadio_Mané' },
    { name: 'Kalidou Koulibaly', pos: 'ZAG', wiki: 'Kalidou_Koulibaly' },
    { name: 'Nicolas Jackson', pos: 'AT', wiki: 'Nicolas_Jackson' },
  ],
  sui: [
    { name: 'Granit Xhaka', pos: 'VOL', wiki: 'Granit_Xhaka' },
    { name: 'Manuel Akanji', pos: 'ZAG', wiki: 'Manuel_Akanji' },
    { name: 'Yann Sommer', pos: 'GOL', wiki: 'Yann_Sommer' },
  ],
  ecu: [
    { name: 'Moisés Caicedo', pos: 'VOL', wiki: 'Moisés_Caicedo' },
    { name: 'Piero Hincapié', pos: 'ZAG', wiki: 'Piero_Hincapié' },
    { name: 'Enner Valencia', pos: 'AT', wiki: 'Enner_Valencia' },
  ],
  tur: [
    { name: 'Arda Güler', pos: 'MEI', wiki: 'Arda_Güler' },
    { name: 'Hakan Çalhanoğlu', pos: 'VOL', wiki: 'Hakan_Çalhanoğlu' },
    { name: 'Kenan Yıldız', pos: 'AT', wiki: 'Kenan_Yıldız' },
  ],
  sco: [
    { name: 'Andrew Robertson', pos: 'LE', wiki: 'Andrew_Robertson' },
    { name: 'Scott McTominay', pos: 'MEI', wiki: 'Scott_McTominay' },
  ],
  swe: [
    { name: 'Viktor Gyökeres', pos: 'AT', wiki: 'Viktor_Gyökeres' },
    { name: 'Alexander Isak', pos: 'AT', wiki: 'Alexander_Isak' },
    { name: 'Dejan Kulusevski', pos: 'MEI', wiki: 'Dejan_Kulusevski' },
  ],
  aut: [
    { name: 'David Alaba', pos: 'ZAG', wiki: 'David_Alaba' },
    { name: 'Marcel Sabitzer', pos: 'MEI', wiki: 'Marcel_Sabitzer' },
  ],
  civ: [
    { name: 'Franck Kessié', pos: 'VOL', wiki: 'Franck_Kessié' },
    { name: 'Sébastien Haller', pos: 'AT', wiki: 'Sébastien_Haller' },
  ],
  gha: [
    { name: 'Mohammed Kudus', pos: 'MEI', wiki: 'Mohammed_Kudus' },
    { name: 'Thomas Partey', pos: 'VOL', wiki: 'Thomas_Partey' },
  ],
  alg: [
    { name: 'Riyad Mahrez', pos: 'AT', wiki: 'Riyad_Mahrez' },
    { name: 'Ismaël Bennacer', pos: 'VOL', wiki: 'Ismaël_Bennacer' },
  ],
  par: [
    { name: 'Miguel Almirón', pos: 'MEI', wiki: 'Miguel_Almirón' },
    { name: 'Julio Enciso', pos: 'AT', wiki: 'Julio_Enciso_(footballer)' },
  ],
  aus: [
    { name: 'Mathew Ryan', pos: 'GOL', wiki: 'Mathew_Ryan' },
    { name: 'Jackson Irvine', pos: 'VOL', wiki: 'Jackson_Irvine' },
  ],
  bih: [
    { name: 'Edin Džeko', pos: 'AT', wiki: 'Edin_Džeko' },
  ],
  cze: [
    { name: 'Patrik Schick', pos: 'AT', wiki: 'Patrik_Schick' },
    { name: 'Tomáš Souček', pos: 'VOL', wiki: 'Tomáš_Souček' },
  ],
};

const SORTED_TEAMS = [...TEAMS].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
const groupedTeams = SORTED_TEAMS.reduce((acc: Record<string, typeof TEAMS>, t) => {
  (acc[t.group] ??= []).push(t);
  return acc;
}, {});
const GROUPED_ENTRIES = Object.entries(groupedTeams).sort(([a], [b]) => a.localeCompare(b));

const POSITIONS = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MEI', 'AT'] as const;

const NAME_POOLS: Record<string, { first: string[]; last: string[] }> = {
  brasil: {
    first: ['Lucas', 'Gabriel', 'Rafael', 'Matheus', 'Felipe', 'Bruno', 'Pedro', 'João', 'Gustavo', 'Diego', 'Thiago', 'Carlos'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Pereira', 'Almeida', 'Barbosa', 'Gomes', 'Ribeiro', 'Melo'],
  },
  argentina: {
    first: ['Mateo', 'Julián', 'Lautaro', 'Enzo', 'Rodrigo', 'Nicolás', 'Emiliano', 'Leandro', 'Facundo', 'Valentín'],
    last: ['Martínez', 'Fernández', 'Álvarez', 'Romero', 'Molina', 'Paredes', 'Lo Celso', 'Medina', 'Palacios', 'Barco'],
  },
  uefa: {
    first: ['Lukas', 'Marco', 'Liam', 'Noah', 'Hugo', 'Julian', 'Matteo', 'Stefan', 'Jan', 'Filip', 'Jonas', 'David'],
    last: ['Weber', 'Keller', 'Rossi', 'Kovacs', 'Hansen', 'Lindqvist', 'Novak', 'Dupont', 'Moreau', 'Bauer', 'Meyer', 'Schmidt'],
  },
  africa: {
    first: ['Ibrahim', 'Moussa', 'Youssef', 'Kofi', 'Sékou', 'Amadou', 'Tariq', 'Idriss', 'Salif', 'Bakary'],
    last: ['Diallo', 'Traoré', 'Kouyaté', 'Mensah', 'Bamba', 'Toure', 'Kamara', 'Cissé', 'Ndiaye', 'Kone'],
  },
  asia: {
    first: ['Haruto', 'Min-jun', 'Ren', 'Ji-hoon', 'Yuki', 'Kaito', 'Tariq', 'Omar', 'Salem', 'Ali'],
    last: ['Tanaka', 'Sato', 'Kim', 'Park', 'Lee', 'Takahashi', 'Al-Harbi', 'Al-Dosari', 'Watanabe', 'Yamamoto'],
  },
  concacaf: {
    first: ['Carlos', 'Diego', 'Luis', 'Tyler', 'Brenden', 'Ricardo', 'Mateo', 'Jordan', 'Kevin', 'Ethan'],
    last: ['Vega', 'Reyes', 'Morales', 'Hernández', 'Ramírez', 'Robinson', 'Flores', 'Cruz', 'Ortiz', 'Navarro'],
  },
  others: {
    first: ['Daniel', 'Oliver', 'Samuel', 'Ryan', 'Thomas', 'Leo', 'Victor', 'David', 'Max', 'Finn'],
    last: ['Andersen', 'Jensen', 'Olsen', 'Brown', 'Wilson', 'Davies', 'Vargas', 'Rojas', 'Silva', 'Castro'],
  },
};

const regionMap: Record<string, keyof typeof NAME_POOLS> = {
  bra: 'brasil', arg: 'argentina',
  mex: 'concacaf', can: 'concacaf', usa: 'concacaf', hai: 'concacaf', pan: 'concacaf', cuc: 'concacaf',
  rsa: 'africa', mar: 'africa', alg: 'africa', sen: 'africa', egy: 'africa', tun: 'africa',
  civ: 'africa', cod: 'africa', gha: 'africa', cpv: 'africa',
  kor: 'asia', qat: 'asia', irn: 'asia', jpn: 'asia', ksa: 'asia', irq: 'asia', uzb: 'asia', jor: 'asia', aus: 'asia',
  cze: 'uefa', bih: 'uefa', sui: 'uefa', sco: 'uefa', par: 'others', tur: 'uefa',
  ger: 'uefa', ecu: 'others', ned: 'uefa', swe: 'uefa', bel: 'uefa',
  esp: 'uefa', uru: 'others', fra: 'uefa', nor: 'uefa', aut: 'uefa',
  por: 'uefa', col: 'others', eng: 'uefa', cro: 'uefa', nzl: 'others',
};

function seededRandom(seed: number): number {
  let s = seed * 16807 + 1;
  s = (s * 1103515245 + 12345) & 0x7fffffff;
  return s / 0x7fffffff;
}

function generateSquad(team: typeof TEAMS[number], teamIdx: number): Player[] {
  const realList = REAL_ROSTERS[team.id] || [];
  const region = regionMap[team.id] || 'others';
  const pool = NAME_POOLS[region];
  const players: Player[] = [];
  const used = new Set<string>();

  for (let i = 0; i < 12; i++) {
    const rarity: string = i === 0 ? 'Ultra Rare' : i < 3 ? 'Rare' : i < 6 ? 'Uncommon' : 'Common';
    const real = realList[i];
    if (real) {
      used.add(real.name);
      players.push({
        id: `${team.id}-${i}`,
        name: real.name,
        position: real.pos,
        teamId: team.id,
        teamName: team.name,
        iso: team.iso,
        rarity,
        wikiTitle: real.wiki,
      });
      continue;
    }

    const r1 = seededRandom(teamIdx * 1000 + i);
    const r2 = seededRandom(teamIdx * 1000 + i + 500);
    const fi = Math.floor(r1 * pool.first.length);
    let li = Math.floor(r2 * pool.last.length);
    let name = `${pool.first[fi]} ${pool.last[li]}`;
    while (used.has(name)) {
      li = (li + 1) % pool.last.length;
      name = `${pool.first[fi]} ${pool.last[li]}`;
    }
    used.add(name);

    players.push({
      id: `${team.id}-${i}`,
      name,
      position: POSITIONS[i % POSITIONS.length],
      teamId: team.id,
      teamName: team.name,
      iso: team.iso,
      rarity,
    });
  }
  return players;
}

const ALL_PLAYERS: Player[] = TEAMS.flatMap((team, i) => generateSquad(team, i));
const PLAYER_BY_ID = new Map(ALL_PLAYERS.map(p => [p.id, p]));
const TEAM_BY_NAME = new Map(TEAMS.map(t => [t.name, t]));

function getRarityLevel(rarity: string): number {
  if (rarity === 'Ultra Rare') return 3;
  if (rarity === 'Rare') return 2;
  if (rarity === 'Uncommon') return 1;
  return 0;
}

function getRarityBorder(rarity: string): string {
  const lvl = getRarityLevel(rarity);
  if (lvl === 0) return 'border-slate-700';
  if (lvl === 1) return 'border-emerald-500/70 shadow-[0_0_10px_rgba(34,197,94,0.3)]';
  if (lvl === 2) return 'border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.45)]';
  if (lvl === 3) return 'border-purple-400 shadow-[0_0_24px_rgba(168,85,247,0.75)] shimmer-rainbow';
  return 'border-slate-700';
}

function getRarityLabel(rarity: string): string {
  const lvl = getRarityLevel(rarity);
  if (lvl === 0) return 'Comum';
  if (lvl === 1) return 'Incomum';
  if (lvl === 2) return 'Rara';
  if (lvl === 3) return 'Super Rara';
  return 'Comum';
}

const COMMON = ALL_PLAYERS.filter(p => p.rarity === 'Common');
const UNCOMMON = ALL_PLAYERS.filter(p => p.rarity === 'Uncommon');
const RARE = ALL_PLAYERS.filter(p => p.rarity === 'Rare' || p.rarity === 'Ultra Rare');

function generatePack(photoMap: Record<string, string>): PokemonCard[] {
  const pick = (arr: Player[]) => arr[Math.floor(Math.random() * arr.length)];
  const toCard = (p: Player): PokemonCard => ({
    id: p.id,
    name: p.name,
    imageUrl: (p.wikiTitle && photoMap[p.wikiTitle]) || '',
    rarity: p.rarity,
    setName: p.teamName,
    setSeries: 'Copa 2026',
    quantity: 1,
  });
  const result: PokemonCard[] = [];
  for (let i = 0; i < 2; i++) result.push(toCard(pick(COMMON)));
  for (let i = 0; i < 2; i++) result.push(toCard(pick(UNCOMMON)));
  result.push(toCard(pick(RARE)));
  return result;
}

function flagUrl(iso: string) {
  return `https://flagcdn.com/w80/${iso}.png`;
}

export default function WorldCupAlbum({
  balance,
  onUpdateBalance,
  collection,
  onCollectionUpdate,
  onSellCard,
  onSellAllDuplicates,
}: {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  userId: string;
  collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void;
  onSellCard: (cardId: string, price: number) => void;
  onSellAllDuplicates: (prices: Record<string, number>) => void;
}) {
  const [packResult, setPackResult] = useState<PokemonCard[]>([]);
  const [opening, setOpening] = useState(false);
  const [revealingIndex, setRevealingIndex] = useState(-1);
  const [wikiPhotos, setWikiPhotos] = useState<Record<string, string>>({});
  const [sportsDbPhotos, setSportsDbPhotos] = useState<Record<string, string>>({});
  const [filterRarity, setFilterRarity] = useState('todas');
  const skipRef = useRef(false);
  const skipHandledRef = useRef(false);
  const { play } = useSound();

  // Fetch Wikipedia portraits in batches of <=50 for all mapped international stars
  useEffect(() => {
    const titles = ALL_PLAYERS.map(p => p.wikiTitle).filter(Boolean) as string[];
    if (titles.length === 0) return;
    fetchWikiThumbnails(titles, 360, 'wc_players_v1').then(map => {
      setWikiPhotos(map);
    });
  }, []);

  // Complementary on-demand lookup via TheSportsDB for pack pulls missing a Wikipedia portrait
  const enrichFromSportsDb = (cards: PokemonCard[]) => {
    for (const card of cards) {
      const player = PLAYER_BY_ID.get(card.id);
      const hasWiki = player?.wikiTitle && wikiPhotos[player.wikiTitle];
      if (hasWiki || sportsDbPhotos[card.id] || card.imageUrl) continue;
      const cleanName = encodeURIComponent(card.name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${cleanName}`)
        .then(r => r.json())
        .then(d => {
          const hit = d?.player?.[0];
          const url = hit?.strCutout || hit?.strThumb;
          if (url) {
            setSportsDbPhotos(prev => ({ ...prev, [card.id]: url }));
          }
        })
        .catch(() => {});
    }
  };

  const getPlayerImage = (playerId: string, savedImageUrl?: string): string | null => {
    const player = PLAYER_BY_ID.get(playerId);
    if (player?.wikiTitle && wikiPhotos[player.wikiTitle]) return wikiPhotos[player.wikiTitle];
    if (sportsDbPhotos[playerId]) return sportsDbPhotos[playerId];
    if (savedImageUrl) return savedImageUrl;
    return null;
  };

  const handleOpenPack = async () => {
    if (balance < PACK_PRICE || opening) return;
    play('reveal');
    onUpdateBalance(-PACK_PRICE);
    setOpening(true);
    setPackResult([]);
    setRevealingIndex(-1);
    skipRef.current = false;
    skipHandledRef.current = false;

    const allCards = generatePack(wikiPhotos);
    setPackResult(allCards);
    enrichFromSportsDb(allCards);

    for (let i = 0; i < allCards.length; i++) {
      await new Promise(r => setTimeout(r, 280));
      if (skipRef.current) break;
      setRevealingIndex(i);
      if (getRarityLevel(allCards[i].rarity) >= 2) play('rare');
    }
    if (!skipRef.current) onCollectionUpdate(allCards);
  };

  const getBasePrice = (r: string): number => {
    const l = getRarityLevel(r);
    return l === 0 ? 0.04 + Math.random() * 0.08 : l === 1 ? 0.08 + Math.random() * 0.16 : l === 2 ? 0.25 + Math.random() * 0.65 : l === 3 ? 6.00 + Math.random() * 24.00 : 0.10;
  };

  const handleSell = (cardId: string) => {
    const card = collection.find(c => c.id === cardId);
    if (card) onSellCard(cardId, getBasePrice(card.rarity));
  };
  const handleSellAll = () => {
    const prices: Record<string, number> = {};
    for (const c of collection) if (c.quantity > 1) prices[c.id] = getBasePrice(c.rarity);
    onSellAllDuplicates(prices);
  };

  const totalPlayers = ALL_PLAYERS.length;
  const uniqueCount = useMemo(() => new Set(collection.map(c => c.id)).size, [collection]);
  const progress = Math.round((uniqueCount / totalPlayers) * 100);
  const collectionMap = useMemo(() => new Map(collection.map(c => [c.id, c])), [collection]);

  return (
    <div className="space-y-4">
      <div className="omnitrix-panel relative overflow-hidden p-4 sm:p-5 rounded-2xl border-brand/25 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand/70 to-transparent" />
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="bg-brand/15 p-3 rounded-xl border border-brand/30 text-brand shadow-[0_0_16px_rgba(0,255,135,0.2)] shrink-0">
            <Medal className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold font-display text-white text-base">🌍 Álbum Copa do Mundo 2026</h3>
              <span className="text-[9px] font-mono bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full">
                FlagCDN + Wiki + SportsDB
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              R$ {PACK_PRICE.toFixed(2)} o pacote • {totalPlayers} figurinhas • {TEAMS.length} seleções
            </p>
          </div>
        </div>
        <button onClick={handleOpenPack} disabled={balance < PACK_PRICE}
          className={`bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 font-black px-5 py-3 rounded-xl text-xs transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-[0_0_18px_rgba(245,158,11,0.3)] ${balance < PACK_PRICE ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <Package className="w-4 h-4" /> Comprar (R$ {PACK_PRICE.toFixed(2)})
        </button>
      </div>

      <div className="bg-[#080a12] border border-[#1a1c2a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400"><span className="text-brand font-bold font-mono">{uniqueCount}</span>/{totalPlayers} figurinhas • {TEAMS.length} seleções</p>
          <p className="text-xs font-bold font-mono text-brand">{progress}%</p>
        </div>
        <div className="h-2.5 bg-[#06070d] rounded-full overflow-hidden border border-[#1a1c2a]">
          <div className="h-full bg-gradient-to-r from-emerald-600 via-brand to-emerald-300 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,255,135,0.4)]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-400 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-brand" /> Álbum Oficial</p>
        <div className="flex items-center gap-2">
          <select value={filterRarity} onChange={e => setFilterRarity(e.target.value)} className="bg-[#07080f] border border-[#1a1c2a] rounded-lg text-[10px] text-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-brand/50">
            <option value="todas">Todas raridades</option>
            <option value="0">Comum</option>
            <option value="1">Incomum</option>
            <option value="2">Rara</option>
            <option value="3">Super Rara</option>
          </select>
          {collection.some(c => c.quantity > 1) && (
            <button onClick={handleSellAll} className="bg-brand/15 hover:bg-brand text-brand hover:text-slate-950 font-bold px-3 py-1.5 rounded-xl text-[10px] border border-brand/30 transition-all cursor-pointer">
              Vender Repetidas
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {opening && packResult.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
            <div className="text-center max-w-2xl w-full">
              <motion.h3 initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-brand font-extrabold font-display text-lg mb-2">
                🎴 Pacote Copa 2026
              </motion.h3>
              <div className="flex items-center justify-center gap-3 mb-5">
                <p className="text-slate-400 text-xs">{Math.min(revealingIndex + 1, packResult.length)} de {packResult.length} figurinhas</p>
                {revealingIndex < packResult.length - 1 ? (
                  <button
                    onClick={() => {
                      if (skipHandledRef.current) return;
                      skipHandledRef.current = true;
                      skipRef.current = true;
                      setRevealingIndex(packResult.length - 1);
                      onCollectionUpdate(packResult);
                    }}
                    className="text-xs text-brand/80 hover:text-brand font-bold uppercase tracking-wider cursor-pointer px-3 py-1 rounded-lg bg-brand/10 border border-brand/25"
                  >
                    Revelar Tudo
                  </button>
                ) : (
                  <button
                    onClick={() => { setOpening(false); setPackResult([]); }}
                    className="text-xs text-slate-950 bg-brand hover:bg-[#00e074] font-black uppercase tracking-wider cursor-pointer px-4 py-1.5 rounded-lg"
                  >
                    Concluir
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 justify-items-center">
                {packResult.map((card, idx) => {
                  const player = PLAYER_BY_ID.get(card.id);
                  const team = player ? { iso: player.iso, name: player.teamName } : TEAM_BY_NAME.get(card.setName);
                  const img = getPlayerImage(card.id, card.imageUrl);
                  const isRare = getRarityLevel(card.rarity) >= 2;
                  const cardInits = card.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

                  return (
                    <motion.div
                      key={idx}
                      initial={{ rotateY: 180, opacity: 0, scale: 0.35 }}
                      animate={idx <= revealingIndex ? { rotateY: 0, opacity: 1, scale: 1 } : {}}
                      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                      className={`w-full max-w-[130px] bg-[#0c0f1a] rounded-xl overflow-hidden border-2 ${getRarityBorder(card.rarity)} holo-foil shadow-lg relative`}
                    >
                      {isRare && (
                        <div className="absolute top-1 right-1 z-20">
                          <Star className={`w-3.5 h-3.5 ${getRarityLevel(card.rarity) >= 3 ? 'text-purple-300' : 'text-amber-400'}`} fill="currentColor" />
                        </div>
                      )}
                      {team && (
                        <img
                          src={flagUrl(team.iso)}
                          alt={team.name}
                          className="absolute top-1.5 left-1.5 z-20 w-6 h-4 object-cover rounded-sm shadow border border-white/20"
                        />
                      )}
                      <div className="bg-[#06070d] w-full aspect-[3/4] relative overflow-hidden flex items-center justify-center">
                        {img ? (
                          <img src={img} alt={card.name} className="w-full h-full object-cover object-top relative z-10"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : null}
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-950/50 to-[#06070d]">
                          <span className="text-2xl font-black text-white/60">{cardInits}</span>
                        </div>
                        {player && (
                          <span className="absolute bottom-1 right-1 z-20 text-[8px] font-mono font-bold bg-black/80 text-brand px-1.5 py-0.5 rounded">
                            {player.position}
                          </span>
                        )}
                      </div>
                      {idx <= revealingIndex && (
                        <div className="p-2 text-center bg-[#080a12]">
                          <p className="text-[10px] font-bold text-slate-100 truncate">{card.name}</p>
                          <p className={`text-[8px] font-bold ${isRare ? 'text-amber-400' : 'text-slate-400'}`}>{getRarityLabel(card.rarity)}</p>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {collection.length === 0 ? (
        <div className="omnitrix-card rounded-2xl p-10 text-center">
          <BookOpen className="w-10 h-10 text-brand/60 mx-auto mb-3" />
          <p className="text-slate-200 text-sm font-bold">Nenhuma figurinha ainda</p>
          <p className="text-slate-400 text-xs mt-1">Compre pacotes para montar seu álbum e completar as {totalPlayers} figurinhas de {TEAMS.length} seleções!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {GROUPED_ENTRIES.map(([group, teams]) => (
            <div key={group} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gradient-to-r from-brand/50 to-transparent" />
                <span className="text-[11px] font-extrabold font-mono text-brand tracking-widest">GRUPO {group}</span>
                <div className="flex-1 h-px bg-gradient-to-l from-brand/50 to-transparent" />
              </div>

              {teams.map(team => {
                const allTeam = ALL_PLAYERS.filter(p => p.teamId === team.id);
                const filteredTeamPlayers = filterRarity === 'todas' ? allTeam : allTeam.filter(p => getRarityLevel(p.rarity) === parseInt(filterRarity));
                const ownedFiltered = filteredTeamPlayers.filter(p => collectionMap.has(p.id));
                if (filteredTeamPlayers.length === 0) return null;

                return (
                  <div key={team.id} className="bg-[#090b13] border border-[#1a1c2a] rounded-xl overflow-hidden">
                    <div className="px-3.5 py-2.5 flex items-center justify-between bg-[#06070d] border-b border-[#1a1c2a]">
                      <div className="flex items-center gap-2.5">
                        <img src={flagUrl(team.iso)} alt={team.name} className="w-6 h-4 object-cover rounded-sm border border-white/15" loading="lazy" />
                        <span className="text-xs font-bold text-slate-100">{team.name}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-brand">{ownedFiltered.length}/{filteredTeamPlayers.length}</span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 p-2.5">
                      {filteredTeamPlayers.map(player => {
                        const sticker = collectionMap.get(player.id);
                        const isRare = getRarityLevel(player.rarity) >= 2;
                        const colInits = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                        const img = sticker ? getPlayerImage(player.id, sticker.imageUrl) : null;

                        return (
                          <div key={player.id}
                            className={`bg-[#06070d] rounded-xl border overflow-hidden group relative transition-all duration-200 hover:scale-[1.03] hover:z-10 ${sticker && isRare ? `${getRarityBorder(player.rarity)} holo-foil` : sticker ? 'border-brand/25' : 'border-[#181b28] opacity-50'}`}>
                            <div className="aspect-[3/4] relative overflow-hidden bg-gradient-to-b from-[#12192b] to-[#06070d] flex items-center justify-center">
                              {sticker && img ? (
                                <img src={img} alt={player.name} className="w-full h-full object-cover object-top relative z-10" loading="lazy"
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : null}
                              <span className="text-xl font-black text-white/30 select-none">{sticker ? colInits : '?'}</span>
                              <img src={flagUrl(team.iso)} alt="" className="absolute top-1 left-1 w-4 h-3 object-cover rounded-[2px] opacity-90 z-20" loading="lazy" />
                              <span className="absolute bottom-1 right-1 text-[7px] font-mono font-bold bg-black/75 text-slate-200 px-1 rounded z-20">
                                {player.position}
                              </span>
                            </div>

                            <div className="p-1 text-center bg-[#070910]">
                              <p className={`text-[8px] font-bold truncate ${sticker ? 'text-slate-100' : 'text-slate-600'}`}>
                                {sticker ? player.name : '???'}
                              </p>
                              {sticker && (
                                <p className={`text-[7px] font-bold ${isRare ? 'text-amber-400' : 'text-slate-400'}`}>
                                  {getRarityLabel(player.rarity)}
                                  {sticker.quantity > 1 && <span className="text-brand ml-1">×{sticker.quantity}</span>}
                                </p>
                              )}
                            </div>

                            {sticker && sticker.quantity > 1 && (
                              <button onClick={() => handleSell(sticker.id)}
                                className="absolute top-1 right-1 z-30 bg-brand hover:bg-[#00e074] text-slate-950 text-[7px] font-black px-1.5 py-0.5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100 shadow">
                                R$ {getBasePrice(player.rarity).toFixed(2)}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
