import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, BookOpen, Star, Medal, Loader2 } from 'lucide-react';
import type { PokemonCard } from '../types';

interface Player {
  id: string;
  name: string;
  position: string;
  teamName: string;
  flag: string;
  rarity: string;
}

const PACK_PRICE = 5.90;

const ALL_PLAYERS: Player[] = [
  { id: 'bra-1', name: 'Vinicius Jr.', position: 'AT', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Ultra Rare' },
  { id: 'bra-2', name: 'Rodrygo', position: 'AT', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Rare' },
  { id: 'bra-3', name: 'Raphinha', position: 'AT', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Rare' },
  { id: 'bra-4', name: 'Endrick', position: 'AT', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Uncommon' },
  { id: 'bra-5', name: 'Alisson', position: 'GOL', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Rare' },
  { id: 'bra-6', name: 'Ederson', position: 'GOL', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Uncommon' },
  { id: 'bra-7', name: 'Marquinhos', position: 'ZAG', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Rare' },
  { id: 'bra-8', name: 'Gabriel Magalhães', position: 'ZAG', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Uncommon' },
  { id: 'bra-9', name: 'Bremer', position: 'ZAG', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Rare' },
  { id: 'bra-10', name: 'Danilo', position: 'LD', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Common' },
  { id: 'bra-11', name: 'Guilherme Arana', position: 'LE', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Common' },
  { id: 'bra-12', name: 'Bruno Guimarães', position: 'VOL', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Rare' },
  { id: 'bra-13', name: 'João Gomes', position: 'VOL', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Uncommon' },
  { id: 'bra-14', name: 'Paquetá', position: 'MEI', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Uncommon' },
  { id: 'bra-15', name: 'André', position: 'VOL', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Uncommon' },
  { id: 'bra-16', name: 'Savinho', position: 'AT', teamName: 'Brasil', flag: '🇧🇷', rarity: 'Uncommon' },
  { id: 'arg-1', name: 'Lionel Messi', position: 'AT', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Ultra Rare' },
  { id: 'arg-2', name: 'Julian Álvarez', position: 'AT', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Rare' },
  { id: 'arg-3', name: 'Lautaro Martínez', position: 'AT', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Rare' },
  { id: 'arg-4', name: 'Enzo Fernández', position: 'MEI', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Rare' },
  { id: 'arg-5', name: 'Ángel Di María', position: 'AT', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Rare' },
  { id: 'arg-6', name: 'Emiliano Martínez', position: 'GOL', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Rare' },
  { id: 'arg-7', name: 'Rodrigo De Paul', position: 'MEI', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Uncommon' },
  { id: 'arg-8', name: 'Alexis Mac Allister', position: 'MEI', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Rare' },
  { id: 'arg-9', name: 'Cristian Romero', position: 'ZAG', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Rare' },
  { id: 'arg-10', name: 'Nicolás Otamendi', position: 'ZAG', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Common' },
  { id: 'arg-11', name: 'Nahuel Molina', position: 'LD', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Common' },
  { id: 'arg-12', name: 'Nicolás Tagliafico', position: 'LE', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Uncommon' },
  { id: 'arg-13', name: 'Leandro Paredes', position: 'VOL', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Common' },
  { id: 'arg-14', name: 'Giovani Lo Celso', position: 'MEI', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Uncommon' },
  { id: 'arg-15', name: 'Alejandro Garnacho', position: 'AT', teamName: 'Argentina', flag: '🇦🇷', rarity: 'Rare' },
  { id: 'fra-1', name: 'Kylian Mbappé', position: 'AT', teamName: 'França', flag: '🇫🇷', rarity: 'Ultra Rare' },
  { id: 'fra-2', name: 'Ousmane Dembélé', position: 'AT', teamName: 'França', flag: '🇫🇷', rarity: 'Rare' },
  { id: 'fra-3', name: 'Eduardo Camavinga', position: 'MEI', teamName: 'França', flag: '🇫🇷', rarity: 'Rare' },
  { id: 'fra-4', name: 'Aurélien Tchouaméni', position: 'VOL', teamName: 'França', flag: '🇫🇷', rarity: 'Rare' },
  { id: 'fra-5', name: 'Mike Maignan', position: 'GOL', teamName: 'França', flag: '🇫🇷', rarity: 'Rare' },
  { id: 'fra-6', name: 'Dayot Upamecano', position: 'ZAG', teamName: 'França', flag: '🇫🇷', rarity: 'Uncommon' },
  { id: 'fra-7', name: 'Ibrahima Konaté', position: 'ZAG', teamName: 'França', flag: '🇫🇷', rarity: 'Uncommon' },
  { id: 'fra-8', name: 'Theo Hernández', position: 'LE', teamName: 'França', flag: '🇫🇷', rarity: 'Rare' },
  { id: 'fra-9', name: 'Jules Koundé', position: 'LD', teamName: 'França', flag: '🇫🇷', rarity: 'Uncommon' },
  { id: 'fra-10', name: 'William Saliba', position: 'ZAG', teamName: 'França', flag: '🇫🇷', rarity: 'Rare' },
  { id: 'fra-11', name: 'Adrien Rabiot', position: 'VOL', teamName: 'França', flag: '🇫🇷', rarity: 'Common' },
  { id: 'fra-12', name: 'Randal Kolo Muani', position: 'AT', teamName: 'França', flag: '🇫🇷', rarity: 'Uncommon' },
  { id: 'fra-13', name: 'Marcus Thuram', position: 'AT', teamName: 'França', flag: '🇫🇷', rarity: 'Rare' },
  { id: 'fra-14', name: 'Lucas Hernandez', position: 'ZAG', teamName: 'França', flag: '🇫🇷', rarity: 'Common' },
  { id: 'fra-15', name: 'Bradley Barcola', position: 'AT', teamName: 'França', flag: '🇫🇷', rarity: 'Uncommon' },
  { id: 'ing-1', name: 'Harry Kane', position: 'AT', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Ultra Rare' },
  { id: 'ing-2', name: 'Jude Bellingham', position: 'MEI', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Ultra Rare' },
  { id: 'ing-3', name: 'Bukayo Saka', position: 'AT', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Rare' },
  { id: 'ing-4', name: 'Phil Foden', position: 'MEI', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Rare' },
  { id: 'ing-5', name: 'Declan Rice', position: 'VOL', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Rare' },
  { id: 'ing-6', name: 'Jordan Pickford', position: 'GOL', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Uncommon' },
  { id: 'ing-7', name: 'John Stones', position: 'ZAG', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Uncommon' },
  { id: 'ing-8', name: 'Kyle Walker', position: 'LD', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Uncommon' },
  { id: 'ing-9', name: 'Luke Shaw', position: 'LE', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Common' },
  { id: 'ing-10', name: 'Cole Palmer', position: 'MEI', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Rare' },
  { id: 'ing-11', name: 'Kieran Trippier', position: 'LD', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Common' },
  { id: 'ing-12', name: 'Conor Gallagher', position: 'VOL', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Common' },
  { id: 'ing-13', name: 'Ezri Konsa', position: 'ZAG', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Common' },
  { id: 'ing-14', name: 'Anthony Gordon', position: 'AT', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Uncommon' },
  { id: 'ing-15', name: 'Jarrod Bowen', position: 'AT', teamName: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rarity: 'Uncommon' },
  { id: 'esp-1', name: 'Lamine Yamal', position: 'AT', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Ultra Rare' },
  { id: 'esp-2', name: 'Pedri', position: 'MEI', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Rare' },
  { id: 'esp-3', name: 'Rodri', position: 'VOL', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Ultra Rare' },
  { id: 'esp-4', name: 'Álvaro Morata', position: 'AT', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Uncommon' },
  { id: 'esp-5', name: 'Dani Olmo', position: 'MEI', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Rare' },
  { id: 'esp-6', name: 'Unai Simón', position: 'GOL', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Uncommon' },
  { id: 'esp-7', name: 'Aymeric Laporte', position: 'ZAG', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Uncommon' },
  { id: 'esp-8', name: 'Pau Cubarsí', position: 'ZAG', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Uncommon' },
  { id: 'esp-9', name: 'Dani Carvajal', position: 'LD', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Rare' },
  { id: 'esp-10', name: 'Nico Williams', position: 'AT', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Rare' },
  { id: 'esp-11', name: 'Fabián Ruiz', position: 'MEI', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Uncommon' },
  { id: 'esp-12', name: 'Ferran Torres', position: 'AT', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Common' },
  { id: 'esp-13', name: 'Gavi', position: 'MEI', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Rare' },
  { id: 'esp-14', name: 'Marc Cucurella', position: 'LE', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Common' },
  { id: 'esp-15', name: 'Mikel Merino', position: 'VOL', teamName: 'Espanha', flag: '🇪🇸', rarity: 'Common' },
  { id: 'por-1', name: 'Cristiano Ronaldo', position: 'AT', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Ultra Rare' },
  { id: 'por-2', name: 'Bruno Fernandes', position: 'MEI', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Rare' },
  { id: 'por-3', name: 'Bernardo Silva', position: 'MEI', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Rare' },
  { id: 'por-4', name: 'Rúben Dias', position: 'ZAG', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Rare' },
  { id: 'por-5', name: 'Rafael Leão', position: 'AT', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Rare' },
  { id: 'por-6', name: 'Diogo Costa', position: 'GOL', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Rare' },
  { id: 'por-7', name: 'João Cancelo', position: 'LD', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Uncommon' },
  { id: 'por-8', name: 'Vitinha', position: 'MEI', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Uncommon' },
  { id: 'por-9', name: 'Nuno Mendes', position: 'LE', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Uncommon' },
  { id: 'por-10', name: 'João Palhinha', position: 'VOL', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Uncommon' },
  { id: 'por-11', name: 'João Félix', position: 'AT', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Common' },
  { id: 'por-12', name: 'Gonçalo Ramos', position: 'AT', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Common' },
  { id: 'por-13', name: 'Francisco Conceição', position: 'AT', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Uncommon' },
  { id: 'por-14', name: 'João Neves', position: 'MEI', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Common' },
  { id: 'por-15', name: 'António Silva', position: 'ZAG', teamName: 'Portugal', flag: '🇵🇹', rarity: 'Common' },
  { id: 'ale-1', name: 'Florian Wirtz', position: 'MEI', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Ultra Rare' },
  { id: 'ale-2', name: 'Jamal Musiala', position: 'MEI', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Ultra Rare' },
  { id: 'ale-3', name: 'İlkay Gündoğan', position: 'MEI', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Rare' },
  { id: 'ale-4', name: 'Kai Havertz', position: 'AT', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Rare' },
  { id: 'ale-5', name: 'Joshua Kimmich', position: 'VOL', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Rare' },
  { id: 'ale-6', name: 'Marc-André ter Stegen', position: 'GOL', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Rare' },
  { id: 'ale-7', name: 'Antonio Rüdiger', position: 'ZAG', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Rare' },
  { id: 'ale-8', name: 'Jonathan Tah', position: 'ZAG', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Uncommon' },
  { id: 'ale-9', name: 'David Raum', position: 'LE', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Common' },
  { id: 'ale-10', name: 'Leroy Sané', position: 'AT', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Rare' },
  { id: 'ale-11', name: 'Niclas Füllkrug', position: 'AT', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Uncommon' },
  { id: 'ale-12', name: 'Pascal Groß', position: 'VOL', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Common' },
  { id: 'ale-13', name: 'Chris Führich', position: 'AT', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Common' },
  { id: 'ale-14', name: 'Benjamin Henrichs', position: 'LD', teamName: 'Alemanha', flag: '🇩🇪', rarity: 'Common' },
  { id: 'hol-1', name: 'Virgil van Dijk', position: 'ZAG', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Ultra Rare' },
  { id: 'hol-2', name: 'Frenkie de Jong', position: 'MEI', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Rare' },
  { id: 'hol-3', name: 'Memphis Depay', position: 'AT', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Rare' },
  { id: 'hol-4', name: 'Cody Gakpo', position: 'AT', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Rare' },
  { id: 'hol-5', name: 'Xavi Simons', position: 'MEI', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Rare' },
  { id: 'hol-6', name: 'Bart Verbruggen', position: 'GOL', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Uncommon' },
  { id: 'hol-7', name: 'Matthijs de Ligt', position: 'ZAG', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Uncommon' },
  { id: 'hol-8', name: 'Nathan Aké', position: 'ZAG', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Uncommon' },
  { id: 'hol-9', name: 'Denzel Dumfries', position: 'LD', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Uncommon' },
  { id: 'hol-10', name: 'Daley Blind', position: 'LE', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Common' },
  { id: 'hol-11', name: 'Tijani Reijnders', position: 'MEI', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Uncommon' },
  { id: 'hol-12', name: 'Wout Weghorst', position: 'AT', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Common' },
  { id: 'hol-13', name: 'Jeremie Frimpong', position: 'LD', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Uncommon' },
  { id: 'hol-14', name: 'Micky van der Ven', position: 'ZAG', teamName: 'Holanda', flag: '🇳🇱', rarity: 'Common' },
  { id: 'ita-1', name: 'Gianluigi Donnarumma', position: 'GOL', teamName: 'Itália', flag: '🇮🇹', rarity: 'Ultra Rare' },
  { id: 'ita-2', name: 'Nicolò Barella', position: 'MEI', teamName: 'Itália', flag: '🇮🇹', rarity: 'Rare' },
  { id: 'ita-3', name: 'Alessandro Bastoni', position: 'ZAG', teamName: 'Itália', flag: '🇮🇹', rarity: 'Rare' },
  { id: 'ita-4', name: 'Sandro Tonali', position: 'VOL', teamName: 'Itália', flag: '🇮🇹', rarity: 'Rare' },
  { id: 'ita-5', name: 'Federico Dimarco', position: 'LE', teamName: 'Itália', flag: '🇮🇹', rarity: 'Uncommon' },
  { id: 'ita-6', name: 'Federico Chiesa', position: 'AT', teamName: 'Itália', flag: '🇮🇹', rarity: 'Rare' },
  { id: 'ita-7', name: 'Giovanni Di Lorenzo', position: 'LD', teamName: 'Itália', flag: '🇮🇹', rarity: 'Uncommon' },
  { id: 'ita-8', name: 'Giacomo Raspadori', position: 'AT', teamName: 'Itália', flag: '🇮🇹', rarity: 'Common' },
  { id: 'ita-9', name: 'Ciro Immobile', position: 'AT', teamName: 'Itália', flag: '🇮🇹', rarity: 'Common' },
  { id: 'ita-10', name: 'Manuel Locatelli', position: 'VOL', teamName: 'Itália', flag: '🇮🇹', rarity: 'Common' },
  { id: 'ita-11', name: 'Giorgio Scalvini', position: 'ZAG', teamName: 'Itália', flag: '🇮🇹', rarity: 'Common' },
  { id: 'ita-12', name: 'Nicolò Zaniolo', position: 'AT', teamName: 'Itália', flag: '🇮🇹', rarity: 'Common' },
  { id: 'uru-1', name: 'Federico Valverde', position: 'MEI', teamName: 'Uruguai', flag: '🇺🇾', rarity: 'Ultra Rare' },
  { id: 'uru-2', name: 'Darwin Núñez', position: 'AT', teamName: 'Uruguai', flag: '🇺🇾', rarity: 'Rare' },
  { id: 'uru-3', name: 'Ronald Araújo', position: 'ZAG', teamName: 'Uruguai', flag: '🇺🇾', rarity: 'Rare' },
  { id: 'uru-4', name: 'Manuel Ugarte', position: 'VOL', teamName: 'Uruguai', flag: '🇺🇾', rarity: 'Uncommon' },
  { id: 'uru-5', name: 'Facundo Pellistri', position: 'AT', teamName: 'Uruguai', flag: '🇺🇾', rarity: 'Uncommon' },
  { id: 'uru-6', name: 'Sergio Rochet', position: 'GOL', teamName: 'Uruguai', flag: '🇺🇾', rarity: 'Common' },
  { id: 'uru-7', name: 'José María Giménez', position: 'ZAG', teamName: 'Uruguai', flag: '🇺🇾', rarity: 'Uncommon' },
  { id: 'uru-8', name: 'Giorgian de Arrascaeta', position: 'MEI', teamName: 'Uruguai', flag: '🇺🇾', rarity: 'Rare' },
  { id: 'uru-9', name: 'Nicolás de la Cruz', position: 'MEI', teamName: 'Uruguai', flag: '🇺🇾', rarity: 'Uncommon' },
  { id: 'uru-10', name: 'Maximiliano Gómez', position: 'AT', teamName: 'Uruguai', flag: '🇺🇾', rarity: 'Common' },
  { id: 'uru-11', name: 'Mathías Olivera', position: 'LE', teamName: 'Uruguai', flag: '🇺🇾', rarity: 'Common' },
];

function getRarityLevel(rarity: string): number {
  if (rarity === 'Ultra Rare') return 3;
  if (rarity === 'Rare') return 2;
  if (rarity === 'Uncommon') return 1;
  return 0;
}

function getRarityBorder(rarity: string): string {
  const lvl = getRarityLevel(rarity);
  if (lvl === 0) return 'border-slate-700';
  if (lvl === 1) return 'border-green-600 shadow-[0_0_8px_rgba(34,197,94,0.3)]';
  if (lvl === 2) return 'border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]';
  if (lvl === 3) return 'border-purple-400 shadow-[0_0_22px_rgba(168,85,247,0.7)] shimmer-rainbow';
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

function generatePack(): PokemonCard[] {
  const pick = (arr: Player[]) => arr[Math.floor(Math.random() * arr.length)];
  const result: PokemonCard[] = [];
  for (let i = 0; i < 2; i++) {
    const p = pick(COMMON);
    result.push({ id: p.id, name: p.name, imageUrl: '', rarity: p.rarity, setName: p.teamName, setSeries: 'Copa 2026', quantity: 1 });
  }
  for (let i = 0; i < 2; i++) {
    const p = pick(UNCOMMON);
    result.push({ id: p.id, name: p.name, imageUrl: '', rarity: p.rarity, setName: p.teamName, setSeries: 'Copa 2026', quantity: 1 });
  }
  const p = pick(RARE);
  result.push({ id: p.id, name: p.name, imageUrl: '', rarity: p.rarity, setName: p.teamName, setSeries: 'Copa 2026', quantity: 1 });
  return result;
}

export default function WorldCupAlbum({ balance, onUpdateBalance, collection, onCollectionUpdate, onSellCard, onSellAllDuplicates }: {
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
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const skipRef = useRef(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const cache = sessionStorage.getItem('wcPlayerPhotos');
    if (cache) { setPhotos(JSON.parse(cache)); return; }
    const results: Record<string, string> = {};
    let done = 0;
    for (const player of ALL_PLAYERS) {
      const name = encodeURIComponent(player.name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      setTimeout(() => {
        fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${name}`)
          .then(r => r.json()).then(d => {
            if (d?.player?.[0]?.strThumb) {
              results[player.id] = d.player[0].strThumb + '/preview';
            }
          }).catch(() => {}).finally(() => {
            done++;
            if (done >= ALL_PLAYERS.length) {
              setPhotos({ ...results });
              sessionStorage.setItem('wcPlayerPhotos', JSON.stringify(results));
            }
          });
      }, Math.random() * 8000);
    }
  }, []);

  const getPlayerImage = (player: Player): string => {
    if (photos[player.id]) return photos[player.id];
    const colors = ['1e3a5f', '2d5a27', '5a2d2d', '2d3a5a', '4a2d5a', '5a4a2d', '2d5a4a', '5a2d3a'];
    const hash = player.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const bg = colors[hash % colors.length];
    const initials = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${bg}&color=fff&size=128&bold=true&font-size=0.4`;
  };

  const handleOpenPack = async () => {
    if (balance < PACK_PRICE) return;
    onUpdateBalance(-PACK_PRICE);
    setOpening(true);
    setPackResult([]);
    setRevealingIndex(-1);
    skipRef.current = false;
    const allCards = generatePack();
    setPackResult(allCards);
    for (let i = 0; i < allCards.length; i++) {
      if (skipRef.current) break;
      await new Promise(r => setTimeout(r, 300));
      setRevealingIndex(i);
    }
    if (!skipRef.current) onCollectionUpdate(allCards);
  };

  const handleSellCard = (cardId: string) => {
    const card = collection.find(c => c.id === cardId);
    if (!card) return;
    onSellCard(cardId, getBasePrice(card.rarity));
  };

  const handleSellAllDuplicates = () => {
    const prices: Record<string, number> = {};
    for (const c of collection) {
      if (c.quantity > 1) prices[c.id] = getBasePrice(c.rarity);
    }
    onSellAllDuplicates(prices);
  };

  const getBasePrice = (rarity: string): number => {
    const lvl = getRarityLevel(rarity);
    if (lvl === 0) return 0.50 + Math.random();
    if (lvl === 1) return 1.50 + Math.random() * 3;
    if (lvl === 2) return 5 + Math.random() * 10;
    if (lvl === 3) return 15 + Math.random() * 35;
    return 1;
  };

  const totalPlayers = ALL_PLAYERS.length;
  const uniqueCount = collection.length;
  const progress = Math.round((uniqueCount / totalPlayers) * 100);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-green-900/20 via-[#0e1017] to-green-900/10 p-5 rounded-2xl border border-green-950/40 flex items-center gap-4">
        <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20 text-green-400">
          <Medal className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-extrabold text-white text-base">🌍 Álbum Copa do Mundo 2026</h3>
          <p className="text-slate-400 text-xs">R$ {PACK_PRICE.toFixed(2)} o pacote • {totalPlayers} figurinhas para colecionar</p>
        </div>
        <button onClick={handleOpenPack} disabled={balance < PACK_PRICE} className={`bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-slate-950 font-bold px-5 py-3 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 shrink-0 ${balance < PACK_PRICE ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <Package className="w-4 h-4" /> Comprar (R$ {PACK_PRICE.toFixed(2)})
        </button>
      </div>

      <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400"><span className="text-green-400 font-bold">{uniqueCount}</span>/{totalPlayers} figurinhas</p>
          <p className="text-xs font-bold text-green-400">{progress}%</p>
        </div>
        <div className="h-2 bg-[#07080f] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {uniqueCount > 0 && uniqueCount < totalPlayers && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-center">
          <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider">Continue comprando pacotes para completar o álbum!</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-green-400" /> Sua coleção
        </p>
        {collection.some(c => c.quantity > 1) && (
          <button onClick={handleSellAllDuplicates} className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold px-3 py-2 rounded-xl text-[10px] transition-all cursor-pointer">
            Vender Repetidas
          </button>
        )}
      </div>

      <AnimatePresence>
        {opening && packResult.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="text-center max-w-lg w-full">
              <motion.h3 initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-green-400 font-extrabold text-lg mb-2">🎴 Pacote de Figurinhas</motion.h3>
              <div className="flex items-center justify-center gap-3 mb-4">
                <p className="text-slate-500 text-xs">{revealingIndex + 1} de {packResult.length} figurinhas</p>
                <button onClick={() => { skipRef.current = true; setRevealingIndex(packResult.length - 1); onCollectionUpdate(packResult); setTimeout(() => setOpening(false), 800); }} className="text-[10px] text-green-400/60 hover:text-green-400 font-bold uppercase tracking-wider transition-colors cursor-pointer">Pular</button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 justify-items-center">
                {packResult.map((card, idx) => {
                  const player = ALL_PLAYERS.find(p => p.id === card.id);
                  const isRare = getRarityLevel(card.rarity) >= 2;
                  return (
                    <motion.div key={idx} initial={{ rotateY: 180, opacity: 0, scale: 0.3 }} animate={idx <= revealingIndex ? { rotateY: 0, opacity: 1, scale: 1 } : {}} transition={{ type: 'spring', stiffness: 180, damping: 18 }} className={`bg-[#1a1c2a] rounded-xl overflow-hidden border-2 ${getRarityBorder(card.rarity)} shadow-lg ${isRare ? 'relative' : ''}`}>
                      {isRare && <div className="absolute -top-1 -right-1 z-10"><Star className={`w-4 h-4 ${getRarityLevel(card.rarity) >= 3 ? 'text-purple-300' : 'text-amber-400'}`} fill="currentColor" /></div>}
                      <div className="bg-[#07080f] p-3 flex items-center justify-center w-full aspect-[3/4]">
                        {player && <img src={getPlayerImage(player)} alt={card.name} className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${card.name.split(' ').map(w => w[0]).join('')}&background=1e3a5f&color=fff&size=128`; }} />}
                      </div>
                      {(idx <= revealingIndex) && (
                        <div className="p-2 text-center">
                          <p className="text-[9px] font-bold text-slate-200 truncate">{card.name}</p>
                          <p className={`text-[7px] font-bold ${isRare ? 'text-amber-400' : 'text-slate-400'}`}>{getRarityLabel(card.rarity)}</p>
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
        <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-2xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-bold">Nenhuma figurinha ainda</p>
          <p className="text-slate-500 text-xs mt-1">Compre pacotes para montar seu álbum e completar os {totalPlayers} jogadores!</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          {ALL_PLAYERS.map(player => {
            const owned = collection.find(c => c.id === player.id);
            const isRare = getRarityLevel(player.rarity) >= 2;
            return (
              <div key={player.id} className={`bg-[#0d0e16] rounded-xl overflow-hidden border-2 transition-all group relative ${owned ? getRarityBorder(player.rarity) : 'border-[#1a1c2a] opacity-40'}`}>
                <div className="bg-[#07080f] p-2 flex items-center justify-center aspect-[3/4] relative">
                  {owned ? (
                    <img src={getPlayerImage(player)} alt={player.name} className="w-full h-full object-contain" loading="lazy" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${player.name.split(' ').map(w => w[0]).join('')}&background=1e3a5f&color=fff&size=128`; }} />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-2xl">{player.flag}</span>
                      <span className="text-[7px] text-slate-600 text-center leading-tight">{player.name.split(' ').pop()}</span>
                    </div>
                  )}
                </div>
                <div className="p-2 text-center">
                  <p className={`text-[9px] font-bold truncate ${owned ? 'text-slate-200' : 'text-slate-600'}`}>{owned ? player.name : '???'}</p>
                  {owned ? (
                    <>
                      <p className={`text-[7px] font-bold ${isRare ? 'text-amber-400' : 'text-slate-400'}`}>{getRarityLabel(player.rarity)}</p>
                      <p className="text-[7px] text-slate-500">{player.flag} {player.teamName}</p>
                      {owned.quantity > 1 && <span className="text-[8px] text-slate-500">×{owned.quantity}</span>}
                    </>
                  ) : <p className="text-[7px] text-slate-700">—</p>}
                </div>
                {owned && owned.quantity > 1 && (
                  <button onClick={() => handleSellCard(owned.id)} className="absolute top-1 right-1 bg-emerald-500/80 hover:bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100">
                    R$ {getBasePrice(player.rarity).toFixed(2)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
