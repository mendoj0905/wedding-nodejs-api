import guestDAL from './guestDAL.js';

export default class GuestService {

  static async getAll() {
    try {
      console.log(`Getting all guests`);
      return await guestDAL.getAll();
    } catch (e) {
      console.error(e);
    } 
  }

  static async add(guestToAdd) {

    try {
      const { firstName, lastName, email } = guestToAdd;
      const existingEmail = await guestDAL.getByEmail(email);
      
      if(existingEmail) {
        const errMessage = `Email already exist - ${email}`;
        throw new Error(errMessage);
      }

      console.log(`Added guest - ${firstName} ${lastName}, email - ${email}`);
      const addedGuest = await guestDAL.add(guestToAdd);
      return addedGuest;

    } catch (e) {
      console.error(e);
    }
  }

  // Check guest exist
  static async remove(email) {
    const deleted_guest = await guestDAL.remove(email);
    const { firstName, lastName } = deleted_guest;
    console.log(`Removed guest - ${firstName} ${lastName}, email - ${email}`);
    return deleted_guest;
    
  }
}