This service provides a set of equipment or gear for a futuristic science fiction character.

Several Character scores affects the equipment they chan gather:
  - Experience. From lower to higher: recruit, rookie, intermediate, regular, veteran, elite. The higher the best equipment they can gather along their previous life. Best equipment usually means more expensive and/or higher technology level
  - Society score (SOC). It is a numeric score between 2 and 12. Means their social position in the social group where they were born. A higher SOC means that a character can obtain better equipment, including items that are beyond what is expected due to their experience.

Each item of equipment needs to have:
  - Technology Level (TL): It is a score between 0 and 15. It measures the minimum technology level required to design and build an item. The TL of an item indicates its availability. For example, it is perfectly legitimate for a SOC 11 veteran diplomatic character to carry a knife that requires TL 2, even though, due to their experience and status, they can carry a TL 14 computer. These are the TL levels and their meanings.:
    - TL 0: (Primitive) No technology.
    - TL 1: (Primitive) Roughly on a par with Bronze or Iron age technology.
    - TL 2: (Primitive) Renaissance technology.
    - TL 3: (Primitive) The advances of TL 2 are now applied, bringing the germ of industrial revolution and steam power.
    - TL 4: (Industrial) The transition to industrial revolution is complete, bringing plastics, radio and other such inventions.
    - TL 5: (Industrial) TL 5 brings widespread electrification, tele-communications and internal combustion.
    - TL 6: (Industrial) TL 6 brings the development of fission power and more advanced computing.
    - TL 7: (Pre-Stellar) A pre-stellar society can reach orbit reliably and has telecommunications satellites.
    - TL 8: (Pre-Stellar) At TL 8, it is possible to reach other worlds in the same system, although terraforming or full colonisation are not within the culture’s capacity.
    - TL 9: (Pre-Stellar) The defining element of TL 9 is the development of gravity manipulation, which makes space travel vastly safer and faster.
    - TL 10: (Early Stellar) With the advent of Jump, nearby systems are opened up.
    - TL 11: (Early Stellar) The first true artificial intelligences become possible, as computers are able to model synaptic networks.
    - TL 12: (Average Stellar) Weather control revolutionises terraforming and agriculture.
    - TL 13: (Average Stellar) The battle dress appears on the battlefield in response to the new weapons.
    - TL 14: (Average Stellar) Fusion weapons become man-portable.
    - TL 15: (High Stellar) Black globe generators suggest a new direction for defensive technologies, while the development of synthetic anagathics means that the human lifespan is now vastly increased.
  - Price in Credits (Cr): it is the price of the item in credits. For the shake of simplicity it is an integer number that represents credits.
  - Name: The name of the item.
  - Species: List of species that have access to this item. When it is empty, it means that all species have their own version of the item.
  - Skill: Some items requires competency in some skill to properly manage them. Empty or null value, means that no special skill is needed. A character will only gather equipment that can handle.
  - Law: Law level in worlds and space stations take a numeric value from 0 (no law) to 18 (Extreme Law,Routinely oppressive and restrictive). The law score of an item is the law level from which it is considered illegal. For example, intrusion software is illegal on words/stations with law levels 4 or beyond so its law score is 4. If an item is always legal (for example a first aid kit) then it will have no law score at all.

Each kind/sub-kind of equipment has additional attributes.
- Armour:
  - Protection: is a string meaning the damage protection.
  - Rad: is a string meaning protection against radiation. "-" when the armour provides no radiation protection.
  - STR: if any, the minimum strength score required to operate while wearing the armor.
  - DEX: if any, the minimum dexterity score required to operate while wearing the armor.
- Weapons:
  - Firearms:
    - Range: short distance in meters.
    - Damage: a string with the base damage.
    - Magazine: amount of ammo by magazine.
    - Traits: a string with any traits the weapon has.
  - Melee: Same attributes as firearms but range is always "melee" and Magazine is always empty. Includes blades, bludgeoning, close combat and shield weapons.
  - Throwing weapons: same attributes as firearms but has no magazine and trait includes either blast radius or stun, in addition to other effects
  - Artillery, rockets and missiles: same as firearms but range is in Km. This kind of weapon cannot be considered gear unless their weight are in Kg (usually they are in Tm). Only foot soldiers would consider bear portable artillery weapons like a infantry mortar. So for the shake of simplicity, this DB will not contain artillery weapons.
  - Explosives: they are meant to blow things but not to be throw or shoot. Stats are the same as firearms but has no magazine and range is always "-"
