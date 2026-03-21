/**
 * seed-clients.js — Seed all funeral home clients into DB.
 * Data is embedded directly so it works on Railway (no CSV file dependency).
 * Idempotent: skips homes that already exist by name.
 */

// All 125 funeral home clients — embedded directly
const FUNERAL_HOMES = [
  { name: 'Adams Funeral Home', address: '129 Coleman Street', city: 'Marlin', state: 'TX', zip: '76661', phone: '+12548033526', email: 'statmcs@duck.com' },
  { name: 'Advantage', address: '7010 Chetwood', city: 'Houston', state: 'TX', zip: '77081', phone: '+17136622030', email: 'statmcs@duck.com' },
  { name: 'American Heritage', address: '10710 Veterans Memorial Dr', city: 'Houston', state: 'TX', zip: '77038', phone: '+12814450050', email: 'statmcs@duck.com' },
  { name: 'Bateman Carroll FH', address: '520 W Powell Blvd', city: 'Gresham', state: 'OR', zip: '97030', phone: '+15036652128', email: 'james.jackson@dignitymemorial.com' },
  { name: 'Bean Massey Burge Beltline', address: '2951 S Beltline Rd', city: 'Grand Prairie', state: 'TX', zip: '75052', phone: '+19729755000', email: 'krystina.king@sci-us.com' },
  { name: 'Bluebonnet Hills', address: '5725 Colleyville Blvd', city: 'Colleyville', state: 'TX', zip: '76034', phone: '+18174985894', email: 'krystina.king@sci-us.com' },
  { name: 'Brenham Memorial Chapel', address: '2300 Stringer St', city: 'Brenham', state: 'TX', zip: '77833', phone: '+19798363611', email: 'briana@brenhammemorialchapel.com' },
  { name: 'Brookside- Champions', address: '3410 Cypress Creek Parkway', city: 'Houston', state: 'TX', zip: '77068', phone: '+12813970800', email: 'statmcs@duck.com' },
  { name: 'Brookside - Cypress Creek', address: '9149 HWY 6 North', city: 'Houston', state: 'TX', zip: '77095', phone: '+12813456061', email: 'statmcs@duck.com' },
  { name: 'Brookside - Lauder', address: '13747 Eastex Freeway', city: 'Houston', state: 'TX', zip: '77038', phone: '+12814496511', email: 'statmcs@duck.com' },
  { name: 'Callaway Jones Funeral Home', address: '3001 S College Ave', city: 'Bryan', state: 'TX', zip: '77801', phone: '+19798223717', email: 'james@callawayjones.com' },
  { name: 'Calvary Hill', address: '3235 Lombardy Lane', city: 'Dallas', state: 'TX', zip: '75220', phone: '+12143575754', email: 'krystina.king@sci-us.com' },
  { name: 'Carl Barnes', address: '746 W 22nd Street', city: 'Houston', state: 'TX', zip: '77008', phone: '+17138694529', email: 'statmcs@duck.com' },
  { name: 'Carnes FH', address: '1102 Indiana St', city: 'South Houston', state: 'TX', zip: '77587', phone: '+17139432500', email: 'scott.mcmanus@carnesfuneralhome.com' },
  { name: 'Cashner', address: '801 Teas Rd', city: 'Conroe', state: 'TX', zip: '77303', phone: '+19367562126', email: 'statmcs@duck.com' },
  { name: 'Chapel Lawn FH', address: '8178 Cline Avenue', city: 'Crown Point', state: 'IN', zip: '46307', phone: '+12193659554', email: 'statmcs@duck.com' },
  { name: 'COEP Crematory', address: '2454 S Dairy Ashford', city: 'Houston', state: 'TX', zip: '77077', phone: '+12814972330', email: 'statmcs@duck.com' },
  { name: 'Chapel of Eternal Peace', address: '2454 S Dairy Ashford', city: 'Houston', state: 'TX', zip: '77077', phone: '+12815318180', email: 'statmcs@duck.com' },
  { name: 'Colonial Funeral Home', address: '625 Kitty Hawk Rd', city: 'Universal City', state: 'TX', zip: '78148', phone: '+12106512018', email: 'loc7474@sci-us.com' },
  { name: 'Cook Walden', address: '6100 North Lamar', city: 'Austin', state: 'TX', zip: '78752', phone: '+15124545611', email: 'statmcs@duck.com' },
  { name: 'Cook Walden Forest Oaks', address: '6300 West Williams Cannon Drive', city: 'Austin', state: 'TX', zip: '78749', phone: '+15128921172', email: 'kimberli.jackson@dignitymemorial.com' },
  { name: 'Cook-Walden Davis', address: '2900 Williams Dr', city: 'Georgetown', state: 'TX', zip: '78628', phone: '+15128632564', email: 'statmcs@duck.com' },
  { name: 'Cook-Walden Capital Parks', address: '14501 North I-35', city: 'Pflugerville', state: 'TX', zip: '78660', phone: '+15122514118', email: 'statmcs@duck.com' },
  { name: 'Cristo Rey', address: '235 North Sampson St', city: 'Houston', state: 'TX', zip: '77003', phone: '+17132371777', email: 'statmcs@duck.com' },
  { name: 'Crown Hill FH', address: '700 W. 38th Street', city: 'Indianapolis', state: 'IN', zip: '46208', phone: '+13179253800', email: 'pmcbee@crownhill.com' },
  { name: 'Cryo-1', address: '2001 Ball Street', city: 'Galveston', state: 'TX', zip: '77550', phone: '+12817739689', email: 'ken@cryo1.org' },
  { name: 'Cypress Creek FH', address: '2000 Cypress Landing Drive', city: 'Houston', state: 'TX', zip: '77090', phone: '+17134989111', email: 'robert@cypresscreekfuneralhome.com' },
  { name: 'Cypress Fairbanks Funeral Home', address: '9926 Jones Rd', city: 'Houston', state: 'TX', zip: '77065', phone: '+12818979823', email: 'Stacy.avist@cyfairfunerals.com' },
  { name: 'Earthman Baytown', address: '8624 Garth Rd', city: 'Baytown', state: 'TX', zip: '77521', phone: '+12814228181', email: 'statmcs@duck.com' },
  { name: 'Earthman Bellaire', address: '4525 Bissonnet St', city: 'Bellaire', state: 'TX', zip: '77401', phone: '+17136676505', email: 'statmcs@duck.com' },
  { name: 'Earthman HC', address: '8303 Katy Freeway', city: 'Houston', state: 'TX', zip: '77024', phone: '+17134658900', email: 'statmcs@duck.com' },
  { name: 'Earthman Resthaven', address: '13102 North Freeway', city: 'Houston', state: 'TX', zip: '77060', phone: '+12814430063', email: 'statmcs@duck.com' },
  { name: 'Earthman Southwest', address: '12555 South Kirkwood', city: 'Stafford', state: 'TX', zip: '77477', phone: '+12812403300', email: 'statmcs@duck.com' },
  { name: 'East FH', address: '602 Olive Street', city: 'Texarkana', state: 'TX', zip: '75501', phone: '+19037933141', email: 'statmcs@duck.com' },
  { name: 'Ellis Resthaven FH and Memorial Home', address: '4616 North Big Spring Street', city: 'Midland', state: 'TX', zip: '79705', phone: '+14326835555', email: 'jennifer.boyd@dignitymemorial.com' },
  { name: 'Evangeline Funeral Home', address: '314 E Saint Peter St', city: 'New Iberia', state: 'LA', zip: '70560', phone: '+13373641881', email: 'tammy.bonin@dignitymemorial.com' },
  { name: 'Evangeline FH', address: '314 E Saint Peter St.', city: 'New Iberia', state: 'LA', zip: '70560', phone: '+13373641881', email: 'kelsey.leblanc@dignitymemorial.com' },
  { name: 'Trevino Palo Alto', address: '2525 Palo Alto Rd', city: 'San Antonio', state: 'TX', zip: '78211', phone: '+12109282445', email: 'Guillermo.lopez@sci-us.com' },
  { name: 'Funerary Del Angel Crespo', address: '4136 Broadway St', city: 'Houston', state: 'TX', zip: '77087', phone: '+17136443831', email: 'statmcs@duck.com' },
  { name: 'Funeraria del Angel', address: '5100 North Fwy', city: 'Houston', state: 'TX', zip: '77022', phone: '+17136956881', email: 'statmcs@duck.com' },
  { name: 'Funeraria del Angel Navigation', address: '2516 Navigation Blvd', city: 'Houston', state: 'TX', zip: '77003', phone: '+17132259567', email: 'statmcs@duck.com' },
  { name: 'FDA Palm Valley', address: '4607 North Sugar Road', city: 'Pharr', state: 'TX', zip: '78577', phone: '+19567875222', email: 'perla.moya@sci-us.com' },
  { name: 'Forest Lawn Funeral Home', address: '4955 Pine Street', city: 'Beaumont', state: 'TX', zip: '77703', phone: '+14098925912', email: 'statmcs@duck.com' },
  { name: 'Forest Park East', address: '21620 Gulf FWY', city: 'Webster', state: 'TX', zip: '77598', phone: '+12813323111', email: 'statmcs@duck.com' },
  { name: 'Forest Park Lawndale', address: '6900 Lawndale Street', city: 'Houston', state: 'TX', zip: '77023', phone: '+17139285141', email: 'statmcs@duck.com' },
  { name: 'Forest Park Missouri City', address: '12650 Shadow Creek Parkway', city: 'Pearland', state: 'TX', zip: '77584', phone: '+18325530160', email: 'statmcs@duck.com' },
  { name: 'Forest Park South', address: '12650 Shadow Creek Parkway', city: 'Pearland', state: 'TX', zip: '77584', phone: '+18325530130', email: 'statmcs@duck.com' },
  { name: 'Forest Park Westheimer', address: '12800 Westheimer Rd', city: 'Houston', state: 'TX', zip: '77077', phone: '+12814972330', email: 'statmcs@duck.com' },
  { name: 'Forest Park The Woodlands', address: '18000 Interstate 45 S', city: 'The Woodlands', state: 'TX', zip: '77384', phone: '+19363215115', email: 'statmcs@duck.com' },
  { name: 'Funeraria del Angel Highland', address: '6705 N FM 88', city: 'Weslaco', state: 'TX', zip: '78596', phone: '+19569685538', email: 'evelin.gonzalez@sci-us.com' },
  { name: 'Funeraria del Angel Mont Meta', address: '26170 SH 345', city: 'San Benito', state: 'TX', zip: '78586', phone: '+19563993097', email: 'statmcs@duck.com' },
  { name: 'Funeraria del Angel Trevino', address: '226 Cupples Road', city: 'San Antonio', state: 'TX', zip: '78237', phone: '+12104340595', email: 'statmcs@duck.com' },
  { name: 'Garden Oaks', address: '13430 Bellaire Blvd', city: 'Houston', state: 'TX', zip: '77083', phone: '+12815305400', email: 'statmcs@duck.com' },
  { name: 'George H Lewis & Sons', address: '1010 Bering Dr', city: 'Houston', state: 'TX', zip: '77057', phone: '+17137893005', email: 'statmcs@duck.com' },
  { name: 'Gipson Funeral Home', address: '1515 South Chestnut', city: 'Lufkin', state: 'TX', zip: '75901', phone: '+19366344411', email: 'statmcs@duck.com' },
  { name: 'Gonzales Dallas', address: '3050 N Stemmons Frwy', city: 'Dallas', state: 'TX', zip: '75247', phone: '+12146305341', email: 'krystina.king@sci-us.com' },
  { name: 'Gonzales Mesquite', address: '1111 Military Pkwy', city: 'Mesquite', state: 'TX', zip: '75149', phone: '+19722855489', email: 'krystina.king@sci-us.com' },
  { name: 'Grammies-Oberle FH', address: '4841 39th St', city: 'Port Arthur', state: 'TX', zip: '77642', phone: '+14099624408', email: 'statmcs@duck.com' },
  { name: 'Grand Prairie FH', address: '733 Dalworrh St', city: 'Grand Prairie', state: 'TX', zip: '75052', phone: '+19722637200', email: 'krystina.king@sci-us.com' },
  { name: 'Grand View Funeral Home', address: '8501 Spencer Highway', city: 'Pasadena', state: 'TX', zip: '77505', phone: '+12814796076', email: 'statmcs@duck.com' },
  { name: 'Grove Hill', address: '3920 Samuel Blvd', city: 'Dallas', state: 'TX', zip: '75225', phone: '+12143888887', email: 'krystina.king@sci-us.com' },
  { name: 'Guardian', address: '5704 James Ave', city: 'Ft Worth', state: 'TX', zip: '76134', phone: '+18172938477', email: 'krystina.king@sci-us.com' },
  { name: 'Gulf Coast Crematory', address: '705 E Burrress St', city: 'Houston', state: 'TX', zip: '77022', phone: '+17135879085', email: 'statmcs@duck.com' },
  { name: 'Hampton Vaughan Crestview', address: '1916 Archer City Hwy', city: 'Wichita Falls', state: 'TX', zip: '76302', phone: '+19407671770', email: 'michael.russell@dignitymemorial.com' },
  { name: 'Heights Funeral Homes', address: '1317 Heights Blvd', city: 'Houston', state: 'TX', zip: '77008', phone: '+17138628844', email: 'statmcs@duck.com' },
  { name: 'Hill Crest Memorial', address: '601 US Hwy 80 East', city: 'Haughton', state: 'LA', zip: '71037', phone: '+13189499415', email: 'statmcs@duck.com' },
  { name: 'Hillsboro Memorial FH', address: '2323 West Brandon Blvd', city: 'Brandon', state: 'FL', zip: '33511', phone: '+18136898121', email: 'statmcs@duck.com' },
  { name: 'HSC', address: '1220 W 34th St', city: 'Houston', state: 'TX', zip: '77018', phone: '+17138630700', email: 'Luis.Gallegos@sci-us.com' },
  { name: 'Houston Service Center', address: '1220 W 34th St', city: 'Houston', state: 'TX', zip: '77018', phone: '+17138630700', email: 'Luis.Gallegos@sci-us.com' },
  { name: 'JE Foust', address: '523 S Main St', city: 'Grapevine', state: 'TX', zip: '76051', phone: '+18174812525', email: 'krystina.king@sci-us.com' },
  { name: 'J.E. Hixson & Sons', address: '3001 Ryan St', city: 'Lake Charles', state: 'LA', zip: '70601', phone: '+13374392446', email: 'rebecca.clavier@dignitymemorial.com' },
  { name: 'Jimerson-Lipsey Funeral Home', address: '1131 SH 149', city: 'Carthage', state: 'TX', zip: '75633', phone: '+19036937125', email: 'jimersonlipsey@yahoo.com' },
  { name: 'Katy Funeral Home', address: '23350 Kingsland Blvd', city: 'Katy', state: 'TX', zip: '77494', phone: '+12813957070', email: 'statmcs@duck.com' },
  { name: 'Keller Old Town FH', address: '220 Keller Prwy', city: 'Keller', state: 'TX', zip: '76248', phone: '+18173376133', email: 'krystina.king@sci-us.com' },
  { name: 'Kingwood Funeral Home', address: '22800 Hwy 59', city: 'Kingwood', state: 'TX', zip: '77339', phone: '+12813589005', email: 'statmcs@duck.com' },
  { name: 'Lake Lawn Metairie FH', address: '5100 Pontchartrain Blvd.', city: 'New Orleans', state: 'LA', zip: '70124', phone: '+15044866331', email: 'statmcs@duck.com' },
  { name: 'Laurel Land Dallas', address: '6000 R.L. Thorton Fwy', city: 'Dallas', state: 'TX', zip: '75214', phone: '+12143711336', email: 'krystina.king@sci-us.com' },
  { name: 'Laurel Land Fort Worth', address: '7100 Crowley Rd', city: 'Ft Worth', state: 'TX', zip: '76134', phone: '+18175680822', email: 'krystina.king@sci-us.com' },
  { name: 'Levy Funeral Directors', address: '4539 Bissonnet', city: 'Bellaire', state: 'TX', zip: '77401', phone: '+17136606633', email: 'statmcs@duck.com' },
  { name: 'Lewis FH SA', address: '811 S WW White Rd', city: 'San Antonio', state: 'TX', zip: '78220', phone: '+12102277281', email: 'tstocks@meadowlawnmemorialpark.com' },
  { name: 'Lockwood Funeral Home', address: '9402 Lockwood Dr', city: 'Houston', state: 'TX', zip: '77016', phone: '+17136331421', email: 'statmcs@duck.com' },
  { name: 'Lovestrong CC', address: '21755 I-45', city: 'Spring', state: 'TX', zip: '77388', phone: '+13463853241', email: 'accounting@lovestrongcc.com' },
  { name: 'Mainland Funeral Home', address: '2711 Texas Ave', city: 'La Marque', state: 'TX', zip: '77568', phone: '+14099388123', email: 'statmcs@duck.com' },
  { name: 'Meadowlawn San Antonio', address: '5611 E Houston St', city: 'San Antonio', state: 'TX', zip: '78220', phone: '+12106613991', email: 'tstocks@meadowlawnmemorialpark.com' },
  { name: 'Memorial Funeral Chapel', address: '1515 S College Ave', city: 'Bryan', state: 'TX', zip: '', phone: '+19798238125', email: 'Lorana.woodall@dignitymemorial.com' },
  { name: 'Memorial Oaks', address: '13001 Katy Freeway', city: 'Houston', state: 'TX', zip: '77079', phone: '+12814972210', email: 'statmcs@duck.com' },
  { name: 'Memory Gardens', address: '8200 Old Brownsville Road', city: 'Corpus Christi', state: 'TX', zip: '78415', phone: '+13612659221', email: 'statmcs@duck.com' },
  { name: 'Metcalf Funeral Directors', address: '1801 East White Oak Terrace', city: 'Conroe', state: 'TX', zip: '77304', phone: '+19367563311', email: 'statmcs@duck.com' },
  { name: 'Metrocrest', address: '1810 N Perry Rd', city: 'Carrollton', state: 'TX', zip: '75006', phone: '+19722423646', email: 'krystina.king@sci-us.com' },
  { name: 'Mitchell Funeral Home', address: '7209 Glenwood Ave', city: 'Raleigh', state: 'NC', zip: '27612', phone: '+19197837128', email: 'statmcs@duck.com' },
  { name: 'Moore Bowen', address: '4216 S Bowen', city: 'Arlington', state: 'TX', zip: '76016', phone: '+18174688111', email: 'krystina.king@sci-us.com' },
  { name: 'Moore Davis', address: '1219 N Davis', city: 'Arlington', state: 'TX', zip: '76012', phone: '+18172752711', email: 'krystina.king@sci-us.com' },
  { name: 'Neptune Cremation Service', address: '2404 Texmati Drive', city: 'Katy', state: 'TX', zip: '77494', phone: '+12818554400', email: 'statmcs@duck.com' },
  { name: 'Navarre Funeral Home', address: '2444 Rollingbrook Drive', city: 'Baytown', state: 'TX', zip: '77521', phone: '+12814228111', email: 'statmcs@duck.com' },
  { name: 'Neptune Society Houston', address: '2901 West Loop South', city: 'Houston', state: 'TX', zip: '', phone: '+17135331690', email: 'statmcs@duck.com' },
  { name: 'Neptune League City', address: '2950 Gulf Freeway S', city: 'League City', state: 'TX', zip: '77573', phone: '+18327694040', email: 'statmcs@duck.com' },
  { name: 'Neptune Society Dallas', address: '3000 Custer Rd #260', city: 'Plano', state: 'TX', zip: '75075', phone: '+19726126839', email: 'krystina.king@sci-us.com' },
  { name: 'Neptune Society FW', address: '6455 Hilltop Dr. #105', city: 'North Richland Hills', state: 'TX', zip: '76180', phone: '+18173306557', email: 'krystina.king@sci-us.com' },
  { name: 'Neptune Society Irving', address: '4835 N O\'Connor Rd', city: 'Irving', state: 'TX', zip: '75062', phone: '+12143575754', email: 'krystina.king@sci-us.com' },
  { name: 'Neptune Society- Austin', address: '911 W Anderson Lane', city: 'Austin', state: 'TX', zip: '78757', phone: '', email: 'statmcs@duck.com' },
  { name: 'Neptune Society - SA', address: '8910 Bandera Rd', city: 'San Antonio', state: 'TX', zip: '78250', phone: '+12108801800', email: 'Veronica.Hernandez@Sci-us.com' },
  { name: 'Oscar Johnson Funeral Home', address: '415 Berry St', city: 'Houston', state: 'TX', zip: '77022', phone: '+17136953313', email: 'oscarjohnsonfuneralhome@gmail.com' },
  { name: 'Pasadena Funeral Home', address: '2203 Pasadena Blvd', city: 'Pasadena', state: 'TX', zip: '77502', phone: '+17134736206', email: 'statmcs@duck.com' },
  { name: 'Pat H Foley Funeral Home', address: '1200 West 34 St', city: 'Houston', state: 'TX', zip: '77018', phone: '+17138696261', email: 'statmcs@duck.com' },
  { name: 'PFH', address: '323 N Comanche St', city: 'San Marcos', state: 'TX', zip: '78666', phone: '+15123534311', email: 'pfh@penningtonfuneralhome.com' },
  { name: 'Porter Loring', address: '2101 North Loop 1604 East', city: 'San Antonio', state: 'TX', zip: '78232', phone: '+12104958221', email: 'pl-north@porterloring.com' },
  { name: 'Restland Coppell', address: '400 S Freeport Pwy', city: 'Coppell', state: 'TX', zip: '75019', phone: '+19727451648', email: 'krystina.king@sci-us.com' },
  { name: 'Restwood Funeral Home', address: '1038 West Plantation DR', city: 'Clute', state: 'TX', zip: '', phone: '+19792972121', email: 'noemi.martinez@dignitymemorial.com' },
  { name: 'Rhoton', address: '1511 S Stemmons Fwy', city: 'Carrollton', state: 'TX', zip: '75006', phone: '+19722425260', email: 'krystina.king@sci-us.com' },
  { name: 'Rosewood Funeral Chapel', address: '3304 Mockingbird Ln', city: 'Victoria', state: 'TX', zip: '77904', phone: '+13615734546', email: 'rosewood3304@yahoo.com' },
  { name: 'Scanio-Harper FH', address: '3110 Airport Rd', city: 'Temple', state: 'TX', zip: '76504', phone: '+12548998888', email: 'loc8522@dignitymemorial.com' },
  { name: 'Settegast and Kopf Company', address: '15015 SW Freeway', city: 'Sugarland', state: 'TX', zip: '77478', phone: '+12815655015', email: 'statmcs@duck.com' },
  { name: 'Shannon Rose Hill', address: '7301 E Lancaster', city: 'Fort Worth', state: 'TX', zip: '76112', phone: '+18174513333', email: 'krystina.king@sci-us.com' },
  { name: 'Shannon Rufe Snow', address: '6001 Rufe Snow', city: 'Fort Worth', state: 'TX', zip: '76148', phone: '+18175149100', email: 'krystina.king@sci-us.com' },
  { name: 'Singing Hills', address: '6221 University', city: 'Dallas', state: 'TX', zip: '75241', phone: '+12143714311', email: 'krystina.king@sci-us.com' },
  { name: 'Sparkman FH', address: '1028 S Greenville', city: 'Richardson', state: 'TX', zip: '75081', phone: '+19722387855', email: 'krystina.king@sci-us.com' },
  { name: 'Sparkman/Crane', address: '10501 Garland Rd', city: 'Dallas', state: 'TX', zip: '75218', phone: '+12143278291', email: 'krystina.king@sci-us.com' },
  { name: 'Sparkman/Hillcrest', address: '7405 W Northwest Hwy', city: 'Dallas', state: 'TX', zip: '75225', phone: '+12143655401', email: 'krystina.king@sci-us.com' },
  { name: 'Stackhouse Mortuary Service', address: '815 S. LaSalle B', city: 'Navasota', state: 'TX', zip: '77868', phone: '+19794121895', email: 'tdstackhouse5@gmail.com' },
  { name: 'Stonebriar', address: '10375 E Preston Rd', city: 'Frisco', state: 'TX', zip: '75034', phone: '+12147051789', email: 'krystina.king@sci-us.com' },
  { name: 'Sunset Funeral Home', address: '1701 Austin Hwy', city: 'San Antonio', state: 'TX', zip: '78218', phone: '+12108282811', email: 'statmcs@duck.com' },
  { name: 'Ted Dickey', address: '2128 18th', city: 'Plano', state: 'TX', zip: '75074', phone: '+19724244511', email: 'krystina.king@sci-us.com' },
  { name: 'Ted Dickey West', address: '7990 George Bush Turnpike', city: 'Dallas', state: 'TX', zip: '75252', phone: '+19724076070', email: 'krystina.king@sci-us.com' },
  { name: 'Waltrip Funeral Directors', address: '1415 Campbell Road', city: 'Houston', state: 'TX', zip: '77055', phone: '+17134652525', email: 'elizabeth.gallegos@dignitymemorial.com' },
  { name: 'Wayne N Tatalovich FH', address: '2205 McNinn St', city: 'Aliquippa', state: 'PA', zip: '15001', phone: '+17244626810', email: 'statmcs@duck.com' },
  { name: 'Weed Corel Fish FH', address: '5416 Parkcrest Dr', city: 'Austin', state: 'TX', zip: '78731', phone: '+15124545013', email: 'Kimberli.jackson@sci-us.com' },
];

function seedClients(db) {
  const getHome = db.prepare(`SELECT id FROM funeral_homes WHERE name = ?`);
  const insertHome = db.prepare(`
    INSERT INTO funeral_homes (name, address, city, state, zip, phone, email)
    VALUES (@name, @address, @city, @state, @zip, @phone, @email)
  `);

  let added = 0, skipped = 0;

  const seed = db.transaction(() => {
    for (const home of FUNERAL_HOMES) {
      const existing = getHome.get(home.name);
      if (existing) { skipped++; continue; }
      insertHome.run(home);
      added++;
    }
  });

  seed();
  console.log(`[seed] Funeral homes: ${added} added, ${skipped} already existed (${FUNERAL_HOMES.length} total in list)`);
}

// Standalone execution
if (require.main === module) {
  const { initDb, getDb } = require('../database');
  initDb();
  seedClients(getDb());
  console.log('[seed] Done.');
}

module.exports = { seedClients };
