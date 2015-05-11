contract NameReg {

   event registerEvent(address indexed owner, bytes32 message, bool success);

   modifier isOwner(bytes32 name, bytes32 message) {
      address cOwner = addrByName[name];

      if (owner != tx.origin && cOwner != tx.origin) {
         registerEvent(tx.origin, message, false);
      } else {
         _
      }
   }

   modifier nameAvailable(bytes32 name, bytes32 message) {
      address cOwner = addrByName[name];

      if (cOwner != 0x0)
         registerEvent(tx.origin, message, false);
      else {
         _
      }
   }

   modifier addrAvailable(address addr, bytes32 message) {
      bytes32 name = nameByAddr[addr];

      if (name != 0x0) {
         registerEvent(tx.origin, message, false);
      } else {
         _
      }
   }

   function NameReg() {
      owner = msg.sender;
   }

   function register(address newRegisterAddr, bytes32 name) external nameAvailable(name, "register.nameUnavailable")  {
      if (msg.value > 0)
         newRegisterAddr.send(msg.value);

      bytes32 oldName = nameByAddr[newRegisterAddr];

      if (oldName != 0x0)
         addrByName[oldName] = 0x0;

      nameByAddr[newRegisterAddr] = name;
      addrByName[name] = newRegisterAddr;

      registerEvent(newRegisterAddr, "register", true);
   }

   function release(bytes32 name) isOwner(name, "release.notOwner") {
      nameByAddr[tx.origin] = 0x0;
      addrByName[name] = 0x0;
      
      //Note: currently data persists in the event that address owner wants to reinstate a name to it. Is this fine?
      
      registerEvent(tx.origin, "release", true);
   }

   function transfer(bytes32 name, address newOwner) isOwner(name, "transfer.notOwner") addrAvailable(newOwner, "transfer.addrUnavailable") {
      nameByAddr[tx.origin] = 0x0;
      nameByAddr[newOwner] = name;
      addrByName[name] = newOwner;

      //transfer data
      data[newOwner] = data[tx.origin];
      delete data[tx.origin];

      registerEvent(tx.origin, "transfer", true);
   }
   
   /*
   Unless there's an easier way to dynamically edit fields of a struct, it has to be manual atm. Add more as required.
   */
   
   function editTwitterVerified(bool status) external {
      data[tx.origin].twitterVerified = status;
      
      registerEvent(tx.origin, "edit.TwitterVerified", true);
   }

   function editTwitterVerifiedLink(bytes link) external {
      data[tx.origin].twitterVerifiedLink = link;
      
      registerEvent(tx.origin, "edit.TwitterVerifiedLink", true);
   }

   address public owner;
   
   struct user {
      //insert more fields here.
      bool twitterVerified;
      bytes twitterVerifiedLink;
   }

   mapping (address => user) public data;
   mapping (address => bytes32) public nameByAddr;
   mapping (bytes32 => address) public addrByName;
}    
